// backend/src/services/booking.service.ts

import { Booking } from '../models/Booking';
import { Homestay } from '../models/Homestay';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { AppError } from '../utils/error.handler';
import { emailService } from './email.service';

interface CreateBookingPayload {
  homestayId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
}

export class BookingService {
  private BOOKING_HOLD_TIME = 15 * 60 * 1000; // 15 minutes

  /**
   * Kiểm tra xem phòng có trống trong khoảng ngày không
   * QUAN TRỌNG: Hàm này được sử dụng trong database transaction
   */
  async isRoomAvailable(
    homestayId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const query: any = {
      homestay: homestayId,
      status: { $in: ['confirmed', 'paid', 'completed'] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate: { $gt: checkInDate },
    };

    // Nếu đang update booking, loại bỏ booking hiện tại khỏi kiểm tra
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const conflictingBooking = await Booking.findOne(query);
    return !conflictingBooking;
  }

  /**
   * Tạo booking mới (with transaction để tránh race condition)
   */
  async createBooking(
    customerId: string,
    payload: CreateBookingPayload,
  ) {
    const { homestayId, checkInDate, checkOutDate, numberOfGuests } = payload;

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkIn >= checkOut) {
      throw new AppError('Check-out date must be after check-in date', 400);
    }

    if (checkIn < new Date()) {
      throw new AppError('Check-in date must be in the future', 400);
    }

    // Calculate number of nights
    const numberOfNights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Bắt đầu transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Lấy thông tin homestay
      const homestay = await Homestay.findById(homestayId).session(session);
      if (!homestay) {
        throw new AppError('Homestay not found', 404);
      }

      // Kiểm tra số lượng khách
      if (numberOfGuests > homestay.maxGuests) {
        throw new AppError(
          `Maximum guests is ${homestay.maxGuests}`,
          400,
        );
      }

      // QUAN TRỌNG: Kiểm tra phòng trống trong transaction
      const isAvailable = await this.isRoomAvailable(
        homestayId,
        checkIn,
        checkOut,
      );

      if (!isAvailable) {
        throw new AppError(
          'Room is not available for the selected dates',
          400,
        );
      }

      // Tính tổng tiền
      const totalPrice = homestay.pricePerNight * numberOfNights;

      // Tạo booking với trạng thái pending
      const booking = new Booking({
        customer: customerId,
        homestay: homestayId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests,
        numberOfNights,
        totalPrice,
        status: 'pending',
      });

      await booking.save({ session });

      // Set timeout để tự động hủy booking nếu không thanh toán
      this.setBookingExpiration(booking._id.toString());

      await session.commitTransaction();

      // Populate thông tin trước khi trả về
      await booking.populate(['customer', 'homestay']);

      return {
        message: 'Booking created successfully. Please complete payment within 15 minutes.',
        booking,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Xử lý thanh toán (giả lập)
   */
  async processPayment(
    bookingId: string,
    paymentMethod: 'qr' | 'card',
    paymentProof?: string,
  ) {
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('homestay');

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.status !== 'pending') {
      throw new AppError(
        `Cannot process payment for booking with status: ${booking.status}`,
        400,
      );
    }

    // Cập nhật trạng thái booking thành "paid"
    booking.status = 'paid';
    booking.paymentMethod = paymentMethod;
    if (paymentProof) {
      booking.paymentProof = paymentProof;
    }

    await booking.save();

    // Gửi email hóa đơn
    await emailService.sendInvoiceEmail(booking);

    // Thông báo cho host
    await emailService.sendNotificationToHost(
      booking.homestay.host,
      `New booking for ${booking.homestay.title}`,
      `Customer ${booking.customer.fullName} has booked your property from ${booking.checkInDate.toDateString()} to ${booking.checkOutDate.toDateString()}`,
    );

    return {
      message: 'Payment processed successfully',
      booking,
    };
  }

  /**
   * Host xác nhận hoặc từ chối booking
   */
  async respondToBooking(
    bookingId: string,
    hostId: string,
    action: 'confirm' | 'cancel',
    cancellationReason?: string,
  ) {
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('homestay');

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Kiểm tra host có quyền quản lý booking này không
    if (booking.homestay.host.toString() !== hostId) {
      throw new AppError('You do not have permission to manage this booking', 403);
    }

    if (action === 'confirm') {
      if (booking.status !== 'paid') {
        throw new AppError('Can only confirm paid bookings', 400);
      }

      booking.status = 'confirmed';
      await booking.save();

      // Gửi email xác nhận cho khách
      await emailService.sendConfirmationEmail(booking);
    } else if (action === 'cancel') {
      if (!['paid', 'confirmed'].includes(booking.status)) {
        throw new AppError('Can only cancel paid or confirmed bookings', 400);
      }

      booking.status = 'cancelled';
      booking.cancellationReason = cancellationReason;
      booking.cancelledBy = 'host';
      await booking.save();

      // Gửi email thông báo hủy cho khách
      await emailService.sendCancellationEmail(booking);
    }

    return {
      message: `Booking ${action}ed successfully`,
      booking,
    };
  }

  /**
   * Khách hàng hủy booking (trước check-in X ngày)
   */
  async cancelBookingByCustomer(
    bookingId: string,
    customerId: string,
    cancellationDaysRequired: number = 3,
  ) {
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('homestay');

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Kiểm tra quyền
    if (booking.customer._id.toString() !== customerId) {
      throw new AppError('You do not have permission to cancel this booking', 403);
    }

    // Kiểm tra trạng thái
    if (!['pending', 'paid', 'confirmed'].includes(booking.status)) {
      throw new AppError(
        `Cannot cancel booking with status: ${booking.status}`,
        400,
      );
    }

    // Kiểm tra thời gian hủy
    const daysUntilCheckIn = Math.ceil(
      (booking.checkInDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilCheckIn < cancellationDaysRequired) {
      throw new AppError(
        `Booking can only be cancelled at least ${cancellationDaysRequired} days before check-in`,
        400,
      );
    }

    booking.status = 'cancelled';
    booking.cancelledBy = 'customer';
    await booking.save();

    // Gửi email thông báo cho host
    await emailService.sendNotificationToHost(
      booking.homestay.host,
      `Booking cancelled for ${booking.homestay.title}`,
      `Customer ${booking.customer.fullName} has cancelled their booking from ${booking.checkInDate.toDateString()} to ${booking.checkOutDate.toDateString()}`,
    );

    return {
      message: 'Booking cancelled successfully',
      booking,
    };
  }

  /**
   * Lấy danh sách booking của khách hàng
   */
  async getCustomerBookings(customerId: string, status?: string) {
    const query: any = { customer: customerId };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('homestay')
      .sort({ createdAt: -1 });

    return bookings;
  }

  /**
   * Lấy danh sách booking của host (phòng họ quản lý)
   */
  async getHostBookings(hostId: string, status?: string) {
    const query: any = { 'homestay.host': hostId };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('homestay')
      .populate('customer')
      .sort({ createdAt: -1 });

    return bookings;
  }

  /**
   * Auto cancel pending bookings sau 15 phút
   */
  private setBookingExpiration(bookingId: string) {
    setTimeout(async () => {
      try {
        const booking = await Booking.findById(bookingId);
        if (booking && booking.status === 'pending') {
          booking.status = 'cancelled';
          booking.cancellationReason = 'Payment not completed within 15 minutes';
          await booking.save();
        }
      } catch (error) {
        console.error(`Error auto-cancelling booking ${bookingId}:`, error);
      }
    }, this.BOOKING_HOLD_TIME);
  }

  /**
   * Lấy thống kê bookings
   */
  async getBookingStats(hostId?: string) {
    const pipeline: any[] = [
      {
        $match: hostId
          ? {
              'homestay.host': new mongoose.Types.ObjectId(hostId),
            }
          : {},
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
        },
      },
    ];

    const stats = await Booking.aggregate(pipeline);

    return {
      total: stats.reduce((sum, s) => sum + s.count, 0),
      byStatus: stats,
      totalRevenue: stats.reduce((sum, s) => sum + (s.totalRevenue || 0), 0),
    };
  }
}

export const bookingService = new BookingService();

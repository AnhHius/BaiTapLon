// backend/src/services/homestay.service.ts

import { Homestay } from '../models/Homestay';
import { Review } from '../models/Review';
import { AppError } from '../utils/error.handler';

interface CreateHomestayPayload {
  title: string;
  description: string;
  address: string;
  city: string;
  pricePerNight: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  images: string[];
}

interface UpdateHomestayPayload extends Partial<CreateHomestayPayload> {}

export class HomestayService {
  /**
   * Tạo homestay mới (Host)
   */
  async createHomestay(
    hostId: string,
    payload: CreateHomestayPayload,
  ) {
    if (!payload.images || payload.images.length === 0) {
      throw new AppError('At least one image is required', 400);
    }

    const homestay = new Homestay({
      ...payload,
      host: hostId,
      isApproved: false, // Chờ admin duyệt
    });

    await homestay.save();
    await homestay.populate('host', 'fullName email avatar');

    return {
      message: 'Homestay created successfully. Waiting for admin approval.',
      homestay,
    };
  }

  /**
   * Lấy danh sách homestay (search & filter)
   */
  async searchHomestays(filters: {
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    guests?: number;
    checkInDate?: Date;
    checkOutDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      city,
      minPrice,
      maxPrice,
      guests,
      checkInDate,
      checkOutDate,
      page = 1,
      limit = 12,
    } = filters;

    const query: any = { isApproved: true };

    // Filter by city
    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }

    // Filter by price
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.pricePerNight = {};
      if (minPrice !== undefined) query.pricePerNight.$gte = minPrice;
      if (maxPrice !== undefined) query.pricePerNight.$lte = maxPrice;
    }

    // Filter by guests
    if (guests) {
      query.maxGuests = { $gte: guests };
    }

    // Tìm kiếm homestay trống (nếu có date)
    let homestays;
    if (checkInDate && checkOutDate) {
      // Lấy tất cả homestay matching, sau đó filter lại
      homestays = await Homestay.find(query)
        .populate('host', 'fullName email avatar')
        .skip((page - 1) * limit)
        .limit(limit);

      // Filter by availability
      const { Booking } = await import('../models/Booking');
      homestays = await Promise.all(
        homestays.map(async (homestay) => {
          const conflict = await Booking.findOne({
            homestay: homestay._id,
            status: { $in: ['confirmed', 'paid', 'completed'] },
            checkInDate: { $lt: checkOutDate },
            checkOutDate: { $gt: checkInDate },
          });
          return { homestay, hasConflict: !!conflict };
        }),
      );
      homestays = homestays
        .filter((h) => !h.hasConflict)
        .map((h) => h.homestay);
    } else {
      homestays = await Homestay.find(query)
        .populate('host', 'fullName email avatar')
        .skip((page - 1) * limit)
        .limit(limit);
    }

    const total = await Homestay.countDocuments(query);

    return {
      homestays,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy chi tiết homestay
   */
  async getHomestayDetail(homestayId: string) {
    const homestay = await Homestay.findById(homestayId).populate('host', 'fullName email avatar phone');

    if (!homestay) {
      throw new AppError('Homestay not found', 404);
    }

    // Lấy reviews
    const reviews = await Review.find({ homestay: homestayId })
      .populate('customer', 'fullName avatar')
      .sort({ createdAt: -1 });

    return {
      homestay,
      reviews,
      reviewCount: reviews.length,
      averageRating: homestay.averageRating,
    };
  }

  /**
   * Cập nhật homestay (Host)
   */
  async updateHomestay(
    homestayId: string,
    hostId: string,
    payload: UpdateHomestayPayload,
  ) {
    const homestay = await Homestay.findById(homestayId);

    if (!homestay) {
      throw new AppError('Homestay not found', 404);
    }

    // Kiểm tra quyền
    if (homestay.host.toString() !== hostId) {
      throw new AppError('You do not have permission to update this homestay', 403);
    }

    // Không cho phép sửa nếu có booking đang active
    const { Booking } = await import('../models/Booking');
    const activeBookings = await Booking.findOne({
      homestay: homestayId,
      status: { $in: ['pending', 'confirmed', 'paid'] },
    });

    if (activeBookings) {
      throw new AppError(
        'Cannot update homestay with active bookings. Please wait for bookings to complete.',
        400,
      );
    }

    Object.assign(homestay, payload);
    await homestay.save();

    return {
      message: 'Homestay updated successfully',
      homestay,
    };
  }

  /**
   * Xóa homestay (Host)
   */
  async deleteHomestay(homestayId: string, hostId: string) {
    const homestay = await Homestay.findById(homestayId);

    if (!homestay) {
      throw new AppError('Homestay not found', 404);
    }

    // Kiểm tra quyền
    if (homestay.host.toString() !== hostId) {
      throw new AppError('You do not have permission to delete this homestay', 403);
    }

    // Không cho phép xóa nếu có booking trong tương lai
    const { Booking } = await import('../models/Booking');
    const futureBookings = await Booking.findOne({
      homestay: homestayId,
      status: { $in: ['pending', 'confirmed', 'paid'] },
      checkInDate: { $gte: new Date() },
    });

    if (futureBookings) {
      throw new AppError(
        'Cannot delete homestay with future bookings',
        400,
      );
    }

    await Homestay.findByIdAndDelete(homestayId);

    return { message: 'Homestay deleted successfully' };
  }

  /**
   * Lấy danh sách homestay của host
   */
  async getHostHomestays(hostId: string) {
    const homestays = await Homestay.find({ host: hostId });
    return homestays;
  }

  /**
   * Admin: Duyệt homestay
   */
  async approveHomestay(homestayId: string) {
    const homestay = await Homestay.findByIdAndUpdate(
      homestayId,
      { isApproved: true },
      { new: true },
    );

    if (!homestay) {
      throw new AppError('Homestay not found', 404);
    }

    return {
      message: 'Homestay approved successfully',
      homestay,
    };
  }

  /**
   * Admin: Danh sách homestay chờ duyệt
   */
  async getPendingHomestays() {
    const homestays = await Homestay.find({ isApproved: false })
      .populate('host', 'fullName email')
      .sort({ createdAt: -1 });

    return homestays;
  }
}

// =====================================

// backend/src/services/review.service.ts

export class ReviewService {
  /**
   * Tạo review (sau khi booking hoàn thành)
   */
  async createReview(
    customerId: string,
    bookingId: string,
    payload: {
      rating: number;
      comment: string;
    },
  ) {
    const { Booking } = await import('../models/Booking');

    // Kiểm tra booking tồn tại và đã hoàn thành
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.customer.toString() !== customerId) {
      throw new AppError('You do not have permission to review this booking', 403);
    }

    // Kiểm tra booking đã hoàn thành
    if (booking.status !== 'completed') {
      throw new AppError(
        'You can only review completed bookings',
        400,
      );
    }

    // Kiểm tra đã review chưa
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) {
      throw new AppError('You have already reviewed this booking', 400);
    }

    // Tạo review
    const review = new Review({
      customer: customerId,
      homestay: booking.homestay,
      booking: bookingId,
      ...payload,
    });

    await review.save();

    // Cập nhật rating của homestay
    await this.updateHomestayRating(booking.homestay.toString());

    return {
      message: 'Review created successfully',
      review,
    };
  }

  /**
   * Cập nhật rating của homestay
   */
  private async updateHomestayRating(homestayId: string) {
    const reviews = await Review.find({ homestay: homestayId });

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    await Homestay.findByIdAndUpdate(homestayId, {
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: reviews.length,
    });
  }

  /**
   * Lấy reviews của homestay
   */
  async getHomestayReviews(homestayId: string) {
    const reviews = await Review.find({ homestay: homestayId })
      .populate('customer', 'fullName avatar')
      .sort({ createdAt: -1 });

    return reviews;
  }
}

export const homestayService = new HomestayService();
export const reviewService = new ReviewService();

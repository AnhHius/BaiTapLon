// backend/src/services/email.service.ts

import nodemailer from 'nodemailer';
import { IBooking } from '../models/Booking';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Cấu hình Nodemailer
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Gửi email hóa đơn
   */
  async sendInvoiceEmail(booking: any) {
    try {
      const invoiceHTML = this.generateInvoiceHTML(booking);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@homestay.com',
        to: booking.customer.email,
        subject: `Invoice for Booking ${booking._id}`,
        html: invoiceHTML,
      });

      console.log(`Invoice email sent to ${booking.customer.email}`);
    } catch (error) {
      console.error('Error sending invoice email:', error);
      // Không throw error, chỉ log để không làm hỏng payment flow
    }
  }

  /**
   * Gửi email xác nhận booking
   */
  async sendConfirmationEmail(booking: any) {
    try {
      const confirmationHTML = this.generateConfirmationHTML(booking);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@homestay.com',
        to: booking.customer.email,
        subject: `Booking Confirmed - ${booking.homestay.title}`,
        html: confirmationHTML,
      });

      console.log(`Confirmation email sent to ${booking.customer.email}`);
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  }

  /**
   * Gửi email hủy booking
   */
  async sendCancellationEmail(booking: any) {
    try {
      const cancellationHTML = this.generateCancellationHTML(booking);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@homestay.com',
        to: booking.customer.email,
        subject: `Booking Cancelled - ${booking.homestay.title}`,
        html: cancellationHTML,
      });

      console.log(`Cancellation email sent to ${booking.customer.email}`);
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }
  }

  /**
   * Gửi thông báo cho host
   */
  async sendNotificationToHost(
    hostId: any,
    subject: string,
    message: string,
  ) {
    try {
      const { User } = await import('../models/User');
      const host = await User.findById(hostId);

      if (!host) return;

      const notificationHTML = `
        <h2>${subject}</h2>
        <p>${message}</p>
        <p>Log in to your dashboard to manage this booking.</p>
      `;

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@homestay.com',
        to: host.email,
        subject,
        html: notificationHTML,
      });

      console.log(`Notification email sent to ${host.email}`);
    } catch (error) {
      console.error('Error sending notification email:', error);
    }
  }

  /**
   * Generate invoice HTML
   */
  private generateInvoiceHTML(booking: any): string {
    const checkIn = new Date(booking.checkInDate).toLocaleDateString();
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3498db; color: white; padding: 20px; text-align: center; }
            .content { margin: 20px 0; }
            .details { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .summary { border-top: 1px solid #ddd; padding-top: 15px; margin-top: 20px; }
            .total { font-size: 18px; font-weight: bold; color: #3498db; }
            .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice</h1>
            </div>

            <div class="content">
              <h3>Booking Details</h3>
              <div class="details">
                <p><strong>Guest:</strong> ${booking.customer.fullName}</p>
                <p><strong>Email:</strong> ${booking.customer.email}</p>
                <p><strong>Property:</strong> ${booking.homestay.title}</p>
                <p><strong>Address:</strong> ${booking.homestay.address}, ${booking.homestay.city}</p>
                <p><strong>Check-in:</strong> ${checkIn}</p>
                <p><strong>Check-out:</strong> ${checkOut}</p>
                <p><strong>Number of Guests:</strong> ${booking.numberOfGuests}</p>
                <p><strong>Number of Nights:</strong> ${booking.numberOfNights}</p>
              </div>

              <div class="summary">
                <p><strong>Price per Night:</strong> $${booking.homestay.pricePerNight}</p>
                <p><strong>Number of Nights:</strong> ${booking.numberOfNights}</p>
                <p class="total">Total: $${booking.totalPrice.toFixed(2)}</p>
              </div>

              <p>Thank you for booking with us!</p>
            </div>

            <div class="footer">
              <p>This is an automated email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate confirmation HTML
   */
  private generateConfirmationHTML(booking: any): string {
    const checkIn = new Date(booking.checkInDate).toLocaleDateString();
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
            .content { margin: 20px 0; }
            .button { background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmed! 🎉</h1>
            </div>

            <div class="content">
              <p>Hi ${booking.customer.fullName},</p>
              
              <p>Your booking for <strong>${booking.homestay.title}</strong> has been confirmed by the host!</p>

              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Check-in:</strong> ${checkIn}</p>
                <p><strong>Check-out:</strong> ${checkOut}</p>
                <p><strong>Location:</strong> ${booking.homestay.address}, ${booking.homestay.city}</p>
              </div>

              <p>The host will contact you soon with further details about check-in procedures.</p>

              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}" class="button">View Booking Details</a>

              <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate cancellation HTML
   */
  private generateCancellationHTML(booking: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Cancelled</h1>
            </div>

            <div class="content">
              <p>Hi ${booking.customer.fullName},</p>
              
              <p>Your booking for <strong>${booking.homestay.title}</strong> has been cancelled.</p>

              ${booking.cancellationReason ? `<p><strong>Reason:</strong> ${booking.cancellationReason}</p>` : ''}

              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();

// =====================================

// backend/src/utils/error.handler.ts

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
export const errorHandler = (err: any, req: any, res: any, next: any) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  console.error(`[${new Date().toISOString()}] ${statusCode} - ${message}`);

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e: any) => e.message);
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation error',
      errors: messages,
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `${field} already exists`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Token expired',
    });
  }

  // Default error response
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
};

// =====================================

// backend/src/utils/validators.ts

export class Validators {
  static validateEmail(email: string): boolean {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone: string): boolean {
    const phoneRegex = /^\d{10,15}$/;
    return phoneRegex.test(phone);
  }

  static validatePrice(price: number): boolean {
    return price > 0 && Number.isFinite(price);
  }

  static validateDateRange(checkIn: Date, checkOut: Date): boolean {
    return checkIn < checkOut && checkIn > new Date();
  }

  static validateRating(rating: number): boolean {
    return rating >= 1 && rating <= 5 && Number.isInteger(rating);
  }
}

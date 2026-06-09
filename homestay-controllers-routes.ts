// backend/src/routes/api.routes.ts

import express, { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { homestayController } from '../controllers/homestay.controller';
import { bookingController } from '../controllers/booking.controller';
import { reviewController } from '../controllers/review.controller';
import { adminController } from '../controllers/admin.controller';
import { authenticate, restrictTo } from '../middlewares/auth.middleware';

const router = Router();

// ============ AUTH ROUTES ============
router.post('/auth/register', authController.signup);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);

// Protected routes - Auth required
router.get('/auth/me', authenticate, authController.getCurrentUser);
router.put('/auth/profile', authenticate, authController.updateProfile);
router.post('/auth/change-password', authenticate, authController.changePassword);

// ============ HOMESTAY ROUTES ============
// Public routes
router.get('/homestays', homestayController.searchHomestays);
router.get('/homestays/:id', homestayController.getHomestayDetail);

// Host routes
router.post('/homestays', authenticate, restrictTo('host'), homestayController.createHomestay);
router.put('/homestays/:id', authenticate, restrictTo('host'), homestayController.updateHomestay);
router.delete('/homestays/:id', authenticate, restrictTo('host'), homestayController.deleteHomestay);
router.get('/homestays/host/my-homestays', authenticate, restrictTo('host'), homestayController.getHostHomestays);

// ============ BOOKING ROUTES ============
router.post('/bookings', authenticate, restrictTo('customer'), bookingController.createBooking);
router.post('/bookings/:id/payment', authenticate, restrictTo('customer'), bookingController.processPayment);
router.post('/bookings/:id/cancel', authenticate, bookingController.cancelBooking);
router.get('/bookings/my-trips', authenticate, restrictTo('customer'), bookingController.getCustomerBookings);
router.get('/bookings/host/manage', authenticate, restrictTo('host'), bookingController.getHostBookings);
router.post('/bookings/:id/respond', authenticate, restrictTo('host'), bookingController.respondToBooking);
router.get('/bookings/stats', authenticate, bookingController.getBookingStats);

// ============ REVIEW ROUTES ============
router.post('/reviews', authenticate, restrictTo('customer'), reviewController.createReview);
router.get('/reviews/homestay/:id', reviewController.getHomestayReviews);

// ============ ADMIN ROUTES ============
router.get('/admin/homestays/pending', authenticate, restrictTo('admin'), adminController.getPendingHomestays);
router.post('/admin/homestays/:id/approve', authenticate, restrictTo('admin'), adminController.approveHomestay);
router.get('/admin/users', authenticate, restrictTo('admin'), adminController.getAllUsers);
router.post('/admin/users/:id/block', authenticate, restrictTo('admin'), adminController.blockUser);
router.get('/admin/dashboard', authenticate, restrictTo('admin'), adminController.getDashboardStats);

export default router;

// =====================================

// backend/src/controllers/auth.controller.ts

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AppError } from '../utils/error.handler';
import { Validators } from '../utils/validators';

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { fullName, email, password, phone, role } = req.body;

      // Validate
      if (!fullName || !email || !password || !phone) {
        throw new AppError('Missing required fields', 400);
      }

      if (!Validators.validateEmail(email)) {
        throw new AppError('Invalid email format', 400);
      }

      if (!Validators.validatePhone(phone)) {
        throw new AppError('Invalid phone format', 400);
      }

      if (password.length < 6) {
        throw new AppError('Password must be at least 6 characters', 400);
      }

      const result = await authService.signup({
        fullName,
        email,
        password,
        phone,
        role: role || 'customer',
      });

      res.status(201).json({
        success: true,
        message: result.message,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      const result = await authService.login({ email, password });

      // Set token as HttpOnly cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        success: true,
        message: result.message,
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('token');
      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const user = await authService.getCurrentUser(userId);

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const updateData = req.body;

      const user = await authService.updateProfile(userId, updateData);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { oldPassword, newPassword, confirmPassword } = req.body;

      if (!oldPassword || !newPassword || !confirmPassword) {
        throw new AppError('Missing required fields', 400);
      }

      if (newPassword !== confirmPassword) {
        throw new AppError('New passwords do not match', 400);
      }

      if (newPassword.length < 6) {
        throw new AppError('New password must be at least 6 characters', 400);
      }

      const result = await authService.changePassword(userId, oldPassword, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

// =====================================

// backend/src/controllers/booking.controller.ts

export class BookingController {
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).user.userId;
      const { homestayId, checkInDate, checkOutDate, numberOfGuests } = req.body;

      const result = await bookingService.createBooking(customerId, {
        homestayId,
        checkInDate,
        checkOutDate,
        numberOfGuests,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        booking: result.booking,
      });
    } catch (error) {
      next(error);
    }
  }

  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingId = req.params.id;
      const { paymentMethod, paymentProof } = req.body;

      const result = await bookingService.processPayment(
        bookingId,
        paymentMethod,
        paymentProof,
      );

      res.status(200).json({
        success: true,
        message: result.message,
        booking: result.booking,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const bookingId = req.params.id;
      const userRole = (req as any).user.role;

      if (userRole === 'customer') {
        const result = await bookingService.cancelBookingByCustomer(bookingId, userId);
        return res.status(200).json({
          success: true,
          message: result.message,
          booking: result.booking,
        });
      }

      // Host can also cancel
      throw new AppError('Only customer can cancel their own booking', 403);
    } catch (error) {
      next(error);
    }
  }

  async getCustomerBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).user.userId;
      const { status } = req.query;

      const bookings = await bookingService.getCustomerBookings(
        customerId,
        status as string,
      );

      res.status(200).json({
        success: true,
        bookings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHostBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const hostId = (req as any).user.userId;
      const { status } = req.query;

      const bookings = await bookingService.getHostBookings(hostId, status as string);

      res.status(200).json({
        success: true,
        bookings,
      });
    } catch (error) {
      next(error);
    }
  }

  async respondToBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const hostId = (req as any).user.userId;
      const bookingId = req.params.id;
      const { action, cancellationReason } = req.body;

      const result = await bookingService.respondToBooking(
        bookingId,
        hostId,
        action,
        cancellationReason,
      );

      res.status(200).json({
        success: true,
        message: result.message,
        booking: result.booking,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBookingStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      const hostId = userRole === 'host' ? userId : undefined;
      const stats = await bookingService.getBookingStats(hostId);

      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const bookingController = new BookingController();

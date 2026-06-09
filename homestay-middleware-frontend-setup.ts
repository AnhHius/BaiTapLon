// backend/src/middlewares/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AppError } from '../utils/error.handler';

/**
 * Middleware: Xác thực JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Lấy token từ header hoặc cookie
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies.token;

    if (!token) {
      throw new AppError('No token provided', 401);
    }

    // Verify token
    const decoded = authService.verifyToken(token);
    (req as any).user = decoded;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Kiểm tra quyền (Role-based)
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return next(
        new AppError('You do not have permission to access this resource', 403),
      );
    }

    next();
  };
};

/**
 * Middleware: Xử lý 404 errors
 */
export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

// =====================================

// backend/src/middlewares/upload.middleware.ts

import multer from 'multer';
import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'homestay-images',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
  } as any,
});

// Create multer upload middleware
export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
    } else {
      cb(null, true);
    }
  },
});

// =====================================

// backend/src/server.ts

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.routes';
import { errorHandler, notFound } from './middlewares/auth.middleware';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api', apiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homestay')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

// =====================================

// frontend/src/components/SearchBar.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/services/api';

export function SearchBar() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    city: '',
    checkInDate: '',
    checkOutDate: '',
    guests: '1',
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const queryParams = new URLSearchParams();
    if (filters.city) queryParams.append('city', filters.city);
    if (filters.checkInDate) queryParams.append('checkInDate', filters.checkInDate);
    if (filters.checkOutDate) queryParams.append('checkOutDate', filters.checkOutDate);
    if (filters.guests) queryParams.append('guests', filters.guests);

    router.push(`/search?${queryParams.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto -mt-12 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <input
            type="text"
            placeholder="Which city?"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
          <input
            type="date"
            value={filters.checkInDate}
            onChange={(e) => setFilters({ ...filters, checkInDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
          <input
            type="date"
            value={filters.checkOutDate}
            onChange={(e) => setFilters({ ...filters, checkOutDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
          <select
            value={filters.guests}
            onChange={(e) => setFilters({ ...filters, guests: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
              <option key={num} value={num}>{num} guest{num > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
      >
        Search
      </button>
    </form>
  );
}

// =====================================

// frontend/src/components/HomestayCard.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { IHomestay } from '@/types';

interface HomestayCardProps {
  homestay: IHomestay;
}

export function HomestayCard({ homestay }: HomestayCardProps) {
  return (
    <Link href={`/homestays/${homestay._id}`}>
      <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition cursor-pointer">
        <div className="relative h-48 w-full">
          <Image
            src={homestay.images[0] || '/placeholder.jpg'}
            alt={homestay.title}
            fill
            className="object-cover"
          />
          <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 text-sm font-bold">
            ⭐ {homestay.averageRating}
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-bold text-lg text-gray-900 truncate">{homestay.title}</h3>
          <p className="text-gray-500 text-sm mb-2">{homestay.city}</p>

          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{homestay.bedrooms}</span> bedrooms •
              <span className="font-semibold ml-1">{homestay.bathrooms}</span> bathrooms
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">${homestay.pricePerNight}</p>
              <p className="text-sm text-gray-500">per night</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// =====================================

// frontend/src/types/index.ts

export interface IUser {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'customer' | 'host' | 'admin';
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
}

export interface IHomestay {
  _id: string;
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
  host: IUser | string;
  isApproved: boolean;
  averageRating: number;
  totalReviews: number;
  createdAt: string;
}

export interface IBooking {
  _id: string;
  customer: IUser | string;
  homestay: IHomestay | string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfNights: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled' | 'completed';
  paymentMethod?: 'qr' | 'card';
  createdAt: string;
}

export interface IReview {
  _id: string;
  customer: IUser;
  homestay: IHomestay | string;
  rating: number;
  comment: string;
  createdAt: string;
}

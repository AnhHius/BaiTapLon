// backend/src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  avatar?: string;
  role: 'customer' | 'host' | 'admin';
  isActive: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [3, 'Full name must be at least 3 characters'],
      maxlength: [50, 'Full name must not exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\d{10,15}$/, 'Phone number must be 10-15 digits'],
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['customer', 'host', 'admin'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);

// =====================================

// backend/src/models/Homestay.ts
export interface IHomestay extends Document {
  title: string;
  description: string;
  address: string;
  city: string;
  country: string;
  pricePerNight: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  images: string[];
  host: mongoose.Types.ObjectId;
  isApproved: boolean;
  averageRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

const HomestaySchema = new Schema<IHomestay>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title must not exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [2000, 'Description must not exceed 2000 characters'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
    },
    country: {
      type: String,
      default: 'Vietnam',
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price must be greater than 0'],
    },
    maxGuests: {
      type: Number,
      required: [true, 'Max guests is required'],
      min: [1, 'Max guests must be at least 1'],
    },
    bedrooms: {
      type: Number,
      required: [true, 'Number of bedrooms is required'],
      min: [1, 'Must have at least 1 bedroom'],
    },
    bathrooms: {
      type: Number,
      required: [true, 'Number of bathrooms is required'],
      min: [1, 'Must have at least 1 bathroom'],
    },
    amenities: [
      {
        type: String,
        enum: ['wifi', 'pool', 'bbq', 'parking', 'kitchen', 'ac', 'heating', 'washing-machine'],
      },
    ],
    images: [
      {
        type: String,
        required: true,
      },
    ],
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Index for search
HomestaySchema.index({ city: 1, isApproved: 1 });
HomestaySchema.index({ host: 1 });
HomestaySchema.index({ pricePerNight: 1 });

export const Homestay = mongoose.model<IHomestay>('Homestay', HomestaySchema);

// =====================================

// backend/src/models/Booking.ts
export interface IBooking extends Document {
  customer: mongoose.Types.ObjectId;
  homestay: mongoose.Types.ObjectId;
  checkInDate: Date;
  checkOutDate: Date;
  numberOfGuests: number;
  numberOfNights: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled' | 'completed';
  paymentMethod?: 'qr' | 'card';
  paymentProof?: string;
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'host';
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    homestay: {
      type: Schema.Types.ObjectId,
      ref: 'Homestay',
      required: true,
    },
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Check-out date is required'],
    },
    numberOfGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'Must have at least 1 guest'],
    },
    numberOfNights: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Price must be greater than 0'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'paid', 'cancelled', 'completed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['qr', 'card'],
    },
    paymentProof: String,
    cancellationReason: String,
    cancelledBy: {
      type: String,
      enum: ['customer', 'host'],
    },
  },
  { timestamps: true },
);

// Index for efficient queries
BookingSchema.index({ customer: 1, status: 1 });
BookingSchema.index({ homestay: 1, checkInDate: 1, checkOutDate: 1 });
BookingSchema.index({ status: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);

// =====================================

// backend/src/models/Review.ts
export interface IReview extends Document {
  customer: mongoose.Types.ObjectId;
  homestay: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    homestay: {
      type: Schema.Types.ObjectId,
      ref: 'Homestay',
      required: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      minlength: [10, 'Comment must be at least 10 characters'],
      maxlength: [1000, 'Comment must not exceed 1000 characters'],
    },
  },
  { timestamps: true },
);

// Index for efficient queries
ReviewSchema.index({ homestay: 1 });
ReviewSchema.index({ customer: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);

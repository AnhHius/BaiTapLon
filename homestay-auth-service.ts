// backend/src/services/auth.service.ts

import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/error.handler';

interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: 'customer' | 'host';
}

interface LoginPayload {
  email: string;
  password: string;
}

export class AuthService {
  private JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private JWT_EXPIRES_IN = '7d';

  /**
   * Đăng ký tài khoản mới
   */
  async signup(payload: SignupPayload) {
    const { fullName, email, password, phone, role } = payload;

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already exists', 400);
    }

    // Tạo user mới
    const user = new User({
      fullName,
      email,
      password,
      phone,
      role,
    });

    await user.save();

    // Loại bỏ password trước khi trả về
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      message: 'User registered successfully',
      user: userResponse,
    };
  }

  /**
   * Đăng nhập và tạo JWT token
   */
  async login(payload: LoginPayload) {
    const { email, password } = payload;

    // Kiểm tra email và password tồn tại
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Lấy user và include password field (mặc định không lấy)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Kiểm tra user có bị khóa không
    if (user.isBlocked) {
      throw new AppError('Your account has been blocked', 403);
    }

    // So sánh password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Tạo JWT token
    const token = this.generateToken(user._id.toString(), user.role);

    // Loại bỏ password trước khi trả về
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      message: 'Login successful',
      token,
      user: userResponse,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        userId: string;
        role: string;
        iat: number;
        exp: number;
      };
      return decoded;
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  /**
   * Lấy thông tin user hiện tại
   */
  async getCurrentUser(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  /**
   * Cập nhật profile
   */
  async updateProfile(userId: string, updateData: any) {
    const { fullName, phone, avatar } = updateData;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          fullName,
          phone,
          avatar,
        },
      },
      { new: true, runValidators: true },
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // Lấy user với password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Kiểm tra mật khẩu cũ
    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }
}

export const authService = new AuthService();

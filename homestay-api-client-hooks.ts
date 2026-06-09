// frontend/services/api.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import { IUser, IHomestay, IBooking, IReview } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Handle errors and token expiration
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  // ============ AUTH ============
  async register(data: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    role: 'customer' | 'host';
  }) {
    const response = await this.client.post<{ user: IUser; token: string }>(
      '/auth/register',
      data,
    );
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post<{ user: IUser; token: string }>(
      '/auth/login',
      { email, password },
    );

    this.token = response.data.token;
    localStorage.setItem('token', this.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));

    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async getCurrentUser() {
    const response = await this.client.get<{ user: IUser }>('/auth/me');
    return response.data.user;
  }

  async updateProfile(data: Partial<IUser>) {
    const response = await this.client.put<{ user: IUser }>(
      '/auth/profile',
      data,
    );
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data.user;
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    await this.client.post('/auth/change-password', {
      oldPassword,
      newPassword,
      confirmPassword,
    });
  }

  // ============ HOMESTAYS ============
  async searchHomestays(filters: {
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    guests?: number;
    checkInDate?: string;
    checkOutDate?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get<{
      homestays: IHomestay[];
      pagination: any;
    }>('/homestays', { params: filters });
    return response.data;
  }

  async getHomestayDetail(id: string) {
    const response = await this.client.get<{
      homestay: IHomestay;
      reviews: IReview[];
      averageRating: number;
    }>(`/homestays/${id}`);
    return response.data;
  }

  async createHomestay(data: FormData) {
    const response = await this.client.post<{ homestay: IHomestay }>(
      '/homestays',
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.homestay;
  }

  async updateHomestay(id: string, data: Partial<IHomestay>) {
    const response = await this.client.put<{ homestay: IHomestay }>(
      `/homestays/${id}`,
      data,
    );
    return response.data.homestay;
  }

  async deleteHomestay(id: string) {
    await this.client.delete(`/homestays/${id}`);
  }

  async getHostHomestays() {
    const response = await this.client.get<IHomestay[]>(
      '/homestays/host/my-homestays',
    );
    return response.data;
  }

  // ============ BOOKINGS ============
  async createBooking(data: {
    homestayId: string;
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
  }) {
    const response = await this.client.post<{ booking: IBooking }>(
      '/bookings',
      data,
    );
    return response.data;
  }

  async getBooking(id: string) {
    const response = await this.client.get<IBooking>(`/bookings/${id}`);
    return response.data;
  }

  async processPayment(
    bookingId: string,
    paymentMethod: 'qr' | 'card',
    paymentProof?: string,
  ) {
    const response = await this.client.post<{ booking: IBooking }>(
      `/bookings/${bookingId}/payment`,
      { paymentMethod, paymentProof },
    );
    return response.data.booking;
  }

  async cancelBooking(bookingId: string) {
    await this.client.post(`/bookings/${bookingId}/cancel`);
  }

  async getCustomerBookings() {
    const response = await this.client.get<IBooking[]>('/bookings/my-trips');
    return response.data;
  }

  async getHostBookings() {
    const response = await this.client.get<IBooking[]>('/bookings/host/manage');
    return response.data;
  }

  async respondToBooking(
    bookingId: string,
    action: 'confirm' | 'cancel',
    cancellationReason?: string,
  ) {
    const response = await this.client.post<{ booking: IBooking }>(
      `/bookings/${bookingId}/respond`,
      { action, cancellationReason },
    );
    return response.data.booking;
  }

  async getBookingStats() {
    const response = await this.client.get<{ stats: any }>(
      '/bookings/stats',
    );
    return response.data;
  }

  // ============ REVIEWS ============
  async createReview(
    bookingId: string,
    data: { rating: number; comment: string },
  ) {
    const response = await this.client.post<{ review: IReview }>(
      '/reviews',
      { bookingId, ...data },
    );
    return response.data.review;
  }

  async getHomestayReviews(homestayId: string) {
    const response = await this.client.get<IReview[]>(
      `/reviews/homestay/${homestayId}`,
    );
    return response.data;
  }

  // ============ ADMIN ============
  async getPendingHomestays() {
    const response = await this.client.get<IHomestay[]>(
      '/admin/homestays/pending',
    );
    return response.data;
  }

  async approveHomestay(id: string) {
    await this.client.post(`/admin/homestays/${id}/approve`);
  }

  async getAllUsers() {
    const response = await this.client.get<IUser[]>('/admin/users');
    return response.data;
  }

  async blockUser(id: string) {
    await this.client.post(`/admin/users/${id}/block`);
  }

  async getAdminDashboard() {
    const response = await this.client.get('/admin/dashboard');
    return response.data;
  }
}

export const apiClient = new ApiClient();

// =====================================

// frontend/hooks/useAuth.ts

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/services/api';
import { IUser } from '@/types';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
        }
      } catch (err: any) {
        console.error('Failed to load user:', err);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const { user: userData, token } = await apiClient.login(email, password);
        setUser(userData);
        router.push('/');
        return true;
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || 'Login failed';
        setError(errorMsg);
        return false;
      }
    },
    [router],
  );

  const register = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
      phone: string,
      role: 'customer' | 'host',
    ) => {
      setError(null);
      try {
        const { user: userData, token } = await apiClient.register({
          fullName,
          email,
          password,
          phone,
          role,
        });
        setUser(userData);
        router.push('/');
        return true;
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || 'Registration failed';
        setError(errorMsg);
        return false;
      }
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
      setUser(null);
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }, [router]);

  const updateProfile = useCallback(async (data: Partial<IUser>) => {
    try {
      const updatedUser = await apiClient.updateProfile(data);
      setUser(updatedUser);
      return true;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Update failed';
      setError(errorMsg);
      return false;
    }
  }, []);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
  };
}

// =====================================

// frontend/hooks/useHomestay.ts

import useSWR, { useSWRConfig } from 'swr';
import { apiClient } from '@/services/api';

export function useSearchHomestays(filters: any) {
  const { data, error, isLoading, mutate } = useSWR(
    ['homestays', filters],
    () => apiClient.searchHomestays(filters),
    { revalidateOnFocus: false },
  );

  return {
    homestays: data?.homestays || [],
    pagination: data?.pagination,
    isLoading,
    error,
    mutate,
  };
}

export function useHostHomestays() {
  const { data, error, isLoading, mutate } = useSWR(
    '/homestays/host',
    () => apiClient.getHostHomestays(),
  );

  return {
    homestays: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useCreateHomestay() {
  const { mutate } = useSWRConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (formData: FormData) => {
      setIsLoading(true);
      setError(null);

      try {
        const homestay = await apiClient.createHomestay(formData);
        // Revalidate the host's homestays list
        mutate('/homestays/host');
        return homestay;
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || 'Failed to create homestay';
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate],
  );

  return { create, isLoading, error };
}

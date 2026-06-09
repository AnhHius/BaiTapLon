// frontend/app/homestays/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiClient } from '@/services/api';
import { BookingForm } from '@/components/BookingForm';
import { ReviewSection } from '@/components/ReviewSection';

export default function HomestayDetailPage() {
  const params = useParams();
  const homestayId = params.id as string;
  const [imageIndex, setImageIndex] = useState(0);

  const { data, error, isLoading } = useSWR(
    `/homestays/${homestayId}`,
    () => apiClient.getHomestayDetail(homestayId),
  );

  if (isLoading) {
    return <div className="text-center py-20">Loading...</div>;
  }

  if (error || !data) {
    return <div className="text-center py-20 text-red-600">Failed to load homestay</div>;
  }

  const { homestay, reviews, averageRating } = data;

  const nextImage = () => {
    setImageIndex((prev) => (prev + 1) % homestay.images.length);
  };

  const prevImage = () => {
    setImageIndex((prev) =>
      prev === 0 ? homestay.images.length - 1 : prev - 1,
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Image Gallery */}
      <div className="relative h-96 bg-black">
        <Image
          src={homestay.images[imageIndex]}
          alt={homestay.title}
          fill
          className="object-cover"
          priority
        />

        {/* Navigation buttons */}
        <button
          onClick={prevImage}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full"
        >
          ←
        </button>
        <button
          onClick={nextImage}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full"
        >
          →
        </button>

        {/* Image counter */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
          {imageIndex + 1} / {homestay.images.length}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {homestay.title}
              </h1>
              <p className="text-gray-600 mb-4">
                📍 {homestay.address}, {homestay.city}
              </p>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-yellow-400">★</span>
                  <span className="ml-2 text-lg font-semibold">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-gray-600 ml-2">
                    ({homestay.totalReviews} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Property details */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">About this property</h2>
              <p className="text-gray-700 mb-6">{homestay.description}</p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-gray-600 text-sm">Bedrooms</p>
                  <p className="text-2xl font-bold">{homestay.bedrooms}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Bathrooms</p>
                  <p className="text-2xl font-bold">{homestay.bathrooms}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Max guests</p>
                  <p className="text-2xl font-bold">{homestay.maxGuests}</p>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h3 className="font-bold mb-3">Amenities</h3>
                <div className="grid grid-cols-2 gap-2">
                  {homestay.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="capitalize">{amenity.replace('-', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Host info */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Meet your host</h2>
              <div className="flex items-center gap-4">
                {typeof homestay.host !== 'string' && (
                  <>
                    {homestay.host.avatar && (
                      <Image
                        src={homestay.host.avatar}
                        alt={homestay.host.fullName}
                        width={60}
                        height={60}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-bold text-lg">{homestay.host.fullName}</p>
                      <p className="text-gray-600">{homestay.host.phone}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Reviews */}
            <ReviewSection
              homestayId={homestayId}
              reviews={reviews}
              isAuthenticated={!!localStorage.getItem('token')}
            />
          </div>

          {/* Booking sidebar */}
          <div className="lg:col-span-1">
            <BookingForm homestay={homestay} />
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================

// frontend/components/BookingForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/services/api';
import { IHomestay } from '@/types';

interface BookingFormProps {
  homestay: IHomestay;
}

export function BookingForm({ homestay }: BookingFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    checkInDate: '',
    checkOutDate: '',
    numberOfGuests: '1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateNights = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    return Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
  };

  const nights = calculateNights();
  const totalPrice = nights * homestay.pricePerNight;

  const handleBook = async () => {
    setError('');

    // Validate
    if (!formData.checkInDate || !formData.checkOutDate) {
      setError('Please select check-in and check-out dates');
      return;
    }

    if (nights < 1) {
      setError('Check-out date must be after check-in date');
      return;
    }

    if (parseInt(formData.numberOfGuests) > homestay.maxGuests) {
      setError(`Maximum guests is ${homestay.maxGuests}`);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.createBooking({
        homestayId: homestay._id,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        numberOfGuests: parseInt(formData.numberOfGuests),
      });

      // Redirect to payment page
      router.push(`/bookings/${response.booking._id}/payment`);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to create booking. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-4 bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <p className="text-gray-600">Price per night</p>
        <p className="text-3xl font-bold text-gray-900">
          ${homestay.pricePerNight}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Check-in
          </label>
          <input
            type="date"
            value={formData.checkInDate}
            onChange={(e) =>
              setFormData({ ...formData, checkInDate: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Check-out
          </label>
          <input
            type="date"
            value={formData.checkOutDate}
            onChange={(e) =>
              setFormData({ ...formData, checkOutDate: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            min={formData.checkInDate || new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Guests
          </label>
          <select
            value={formData.numberOfGuests}
            onChange={(e) =>
              setFormData({ ...formData, numberOfGuests: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {Array.from({ length: homestay.maxGuests }, (_, i) => i + 1).map(
              (num) => (
                <option key={num} value={num}>
                  {num} guest{num > 1 ? 's' : ''}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {nights > 0 && (
        <div className="border-t pt-4 mb-6">
          <div className="flex justify-between mb-2">
            <span>${homestay.pricePerNight} × {nights} nights</span>
            <span>${(homestay.pricePerNight * nights).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleBook}
        disabled={loading || !formData.checkInDate || !formData.checkOutDate}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
      >
        {loading ? 'Booking...' : 'Reserve'}
      </button>

      <p className="text-sm text-gray-600 text-center mt-4">
        You won't be charged yet
      </p>
    </div>
  );
}

// =====================================

// frontend/hooks/useBooking.ts

import useSWR from 'swr';
import { apiClient } from '@/services/api';

export function useMyTrips() {
  const { data, error, isLoading, mutate } = useSWR(
    '/bookings/my-trips',
    () => apiClient.getCustomerBookings(),
  );

  return {
    trips: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useHostBookings() {
  const { data, error, isLoading, mutate } = useSWR(
    '/bookings/host/manage',
    () => apiClient.getHostBookings(),
  );

  return {
    bookings: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useBookingStats() {
  const { data, error } = useSWR(
    '/bookings/stats',
    () => apiClient.getBookingStats(),
  );

  return {
    stats: data?.stats,
    isLoading: !error && !data,
    error,
  };
}

// =====================================

// frontend/app/bookings/[id]/payment/page.tsx

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiClient } from '@/services/api';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'card'>('qr');
  const [loading, setLoading] = useState(false);

  const { data: booking, isLoading } = useSWR(
    `/bookings/${bookingId}`,
    () => apiClient.getBooking(bookingId),
  );

  const handlePayment = async () => {
    setLoading(true);

    try {
      await apiClient.processPayment(bookingId, paymentMethod);
      alert('Payment successful! Check your email for the invoice.');
      router.push('/bookings/my-trips');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div className="text-center py-20">Loading...</div>;
  if (!booking) return <div className="text-center py-20">Booking not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-8">Payment</h1>

          {/* Booking summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Booking Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Property:</span>
                <span className="font-semibold">{booking.homestay.title}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-in:</span>
                <span>{new Date(booking.checkInDate).toDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-out:</span>
                <span>{new Date(booking.checkOutDate).toDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Nights:</span>
                <span>{booking.numberOfNights}</span>
              </div>
              <div className="border-t pt-4 mt-4 flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span>${booking.totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment method selection */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Select Payment Method</h2>

            <div className="space-y-4">
              {/* QR Code option */}
              <label className="flex items-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500"
                     onClick={() => setPaymentMethod('qr')}>
                <input
                  type="radio"
                  name="payment"
                  value="qr"
                  checked={paymentMethod === 'qr'}
                  readOnly
                  className="mr-4"
                />
                <div>
                  <p className="font-bold">QR Code Transfer</p>
                  <p className="text-gray-600 text-sm">Scan QR code to pay</p>
                </div>
              </label>

              {/* Card option */}
              <label className="flex items-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500"
                     onClick={() => setPaymentMethod('card')}>
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === 'card'}
                  readOnly
                  className="mr-4"
                />
                <div>
                  <p className="font-bold">Credit/Debit Card</p>
                  <p className="text-gray-600 text-sm">Visa, Mastercard, etc.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Payment preview */}
          {paymentMethod === 'qr' && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <p className="text-center text-gray-700 mb-4">
                Scan this QR code to complete payment
              </p>
              <div className="w-48 h-48 mx-auto bg-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-gray-600">QR Code Preview</span>
              </div>
            </div>
          )}

          {paymentMethod === 'card' && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Card Number</label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Expiry</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">CVV</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
          >
            {loading ? 'Processing...' : `Pay $${booking.totalPrice.toFixed(2)}`}
          </button>

          <p className="text-sm text-gray-600 text-center mt-4">
            This is a simulated payment for demonstration purposes
          </p>
        </div>
      </div>
    </div>
  );
}

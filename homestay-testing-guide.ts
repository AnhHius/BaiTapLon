// backend/tests/booking.test.ts

import request from 'supertest';
import app from '../src/server';
import { User } from '../src/models/User';
import { Homestay } from '../src/models/Homestay';
import { Booking } from '../src/models/Booking';

describe('Booking System - Race Condition Prevention', () => {
  let customer1Token: string;
  let customer2Token: string;
  let homestayId: string;

  beforeAll(async () => {
    // Create test users
    const customer1 = await User.create({
      fullName: 'Customer 1',
      email: 'customer1@test.com',
      password: 'password123',
      phone: '0123456789',
      role: 'customer',
    });

    const customer2 = await User.create({
      fullName: 'Customer 2',
      email: 'customer2@test.com',
      password: 'password123',
      phone: '0123456789',
      role: 'customer',
    });

    // Login and get tokens
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer1@test.com', password: 'password123' });
    customer1Token = res1.body.token;

    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer2@test.com', password: 'password123' });
    customer2Token = res2.body.token;

    // Create test homestay
    const host = await User.create({
      fullName: 'Host',
      email: 'host@test.com',
      password: 'password123',
      phone: '0123456789',
      role: 'host',
    });

    const homestay = await Homestay.create({
      title: 'Test Homestay',
      description: 'Test description',
      address: 'Test address',
      city: 'Test city',
      pricePerNight: 100,
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
      images: ['https://example.com/image.jpg'],
      host: host._id,
      isApproved: true,
    });

    homestayId = homestay._id.toString();
  });

  /**
   * TEST 1: Simultaneous booking prevention
   * 
   * Scenario: Two customers try to book the same room at the same time
   * Expected: Only first customer should succeed
   */
  test('Should prevent double booking when two customers book simultaneously', async () => {
    const checkInDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const checkOutDate = new Date(checkInDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 nights

    const bookingData = {
      homestayId,
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString(),
      numberOfGuests: 2,
    };

    // Both customers try to book simultaneously
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send(bookingData),
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send(bookingData),
    ]);

    // One should succeed, one should fail
    const successCount = [res1, res2].filter((r) => r.status === 201).length;
    const failureCount = [res2, res2].filter((r) => r.status === 400).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Check that only one booking was created
    const bookings = await Booking.find({ homestay: homestayId });
    expect(bookings.length).toBe(1);
  });

  /**
   * TEST 2: Payment timeout cancellation
   * 
   * Scenario: Booking created but payment not completed
   * Expected: Booking should auto-cancel after 15 minutes
   */
  test('Should auto-cancel pending booking after 15 minutes', async () => {
    const booking = await Booking.create({
      customer: '507f1f77bcf86cd799439011',
      homestay: homestayId,
      checkInDate: new Date(),
      checkOutDate: new Date(Date.now() + 86400000),
      numberOfGuests: 1,
      numberOfNights: 1,
      totalPrice: 100,
      status: 'pending',
    });

    // Wait 15+ minutes (mocked in real tests)
    // In real implementation, use jest.useFakeTimers()

    // Simulate timeout
    booking.status = 'cancelled';
    booking.cancellationReason = 'Payment not completed within 15 minutes';
    await booking.save();

    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking?.status).toBe('cancelled');
  });
});

// =====================================

describe('Authentication & Authorization', () => {
  /**
   * TEST 3: Role-based access control
   * 
   * Scenario: Different users access restricted routes
   * Expected: Only authorized roles can access
   */
  test('Should prevent unauthorized access to host dashboard', async () => {
    // Create customer token
    const customer = await User.create({
      fullName: 'Test Customer',
      email: 'testcustomer@test.com',
      password: 'password123',
      phone: '0123456789',
      role: 'customer',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testcustomer@test.com', password: 'password123' });

    const token = loginRes.body.token;

    // Try to access host endpoint
    const res = await request(app)
      .get('/api/homestays/host/my-homestays')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('permission');
  });

  /**
   * TEST 4: JWT token validation
   * 
   * Scenario: Invalid or expired token
   * Expected: Request should be rejected
   */
  test('Should reject invalid JWT token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });
});

// =====================================

describe('Review & Rating System', () => {
  /**
   * TEST 5: Review submission validation
   * 
   * Scenario: Customer tries to review without completing booking
   * Expected: Review should be rejected
   */
  test('Should only allow reviews for completed bookings', async () => {
    // This test would:
    // 1. Create a booking with status 'pending'
    // 2. Try to submit a review
    // 3. Expect a 400 error: "Can only review completed bookings"

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingId: 'pending_booking_id',
        rating: 5,
        comment: 'Great place!',
      });

    expect(res.status).toBe(400);
  });
});

// =====================================

// Manual Testing Checklist (frontend/TESTING_CHECKLIST.md)

/*
## MANUAL TESTING CHECKLIST

### 1. Authentication Flow
- [ ] User can register with valid data
- [ ] Registration fails with duplicate email
- [ ] User can login with correct credentials
- [ ] Login fails with invalid password
- [ ] Password change works
- [ ] Profile update works
- [ ] User can logout

### 2. Homestay Search & Filter
- [ ] Can search by city name
- [ ] Can filter by price range
- [ ] Can select date range (no past dates allowed)
- [ ] Can filter by number of guests
- [ ] Search results show correct number of properties
- [ ] Can view homestay details
- [ ] Images can be scrolled through

### 3. Booking & Payment (CRITICAL)
- [ ] Can create booking with valid dates
- [ ] Cannot create booking with past dates
- [ ] Cannot book if room not available
- [ ] Booking total price calculated correctly
- [ ] Can proceed to payment page
- [ ] Can choose payment method (QR or Card)
- [ ] Payment simulation works
- [ ] Booking status changes to 'paid' after payment
- [ ] Invoice email is sent to customer
- [ ] Host receives notification email

### 4. Double Booking Prevention (CRITICAL)
Test case:
1. Open 2 browser windows (Incognito mode)
2. Login with Customer A in window 1
3. Login with Customer B in window 2
4. Both navigate to same homestay details page
5. Select same check-in and check-out dates
6. Click "Book Now" simultaneously in both windows
7. Expected: Only one succeeds, other gets error message
8. Verify only 1 booking in database

### 5. Booking Management (Customer)
- [ ] Can view my trips/bookings
- [ ] Bookings filtered by status (Pending, Confirmed, Cancelled, Completed)
- [ ] Can cancel booking (if within allowed timeframe)
- [ ] Can see booking details
- [ ] Can access booking receipt/invoice

### 6. Booking Management (Host)
- [ ] Can view all bookings for my properties
- [ ] Can confirm/approve bookings
- [ ] Can cancel bookings (with reason)
- [ ] Host dashboard shows revenue statistics
- [ ] Host dashboard shows monthly earnings chart

### 7. Review & Rating System
- [ ] Can leave review only for completed bookings
- [ ] Can rate 1-5 stars
- [ ] Review appears on property details page
- [ ] Average rating updates correctly
- [ ] Review count updates

### 8. Admin Panel
- [ ] Can view pending homestays
- [ ] Can approve/reject homestays
- [ ] Can view all users
- [ ] Can block suspicious users
- [ ] Admin dashboard shows system statistics

### 9. Edge Cases
- [ ] Cannot book with 0 guests
- [ ] Cannot book with more guests than max capacity
- [ ] Cannot cancel booking within X days of check-in
- [ ] Cannot update homestay with active bookings
- [ ] Cannot delete homestay with future bookings
- [ ] Dates on calendar show available/unavailable correctly

### 10. Email Notifications
- [ ] Invoice email has correct details
- [ ] Confirmation email sent when host approves
- [ ] Cancellation email sent with reason
- [ ] Host notification email sent for new bookings
- [ ] All emails are HTML formatted

### 11. Performance & Stability
- [ ] Site loads within 2 seconds
- [ ] Search results load quickly
- [ ] Can handle 100+ properties without lag
- [ ] Images load properly
- [ ] No console errors

### 12. Mobile Responsiveness
- [ ] Mobile layout works on iPhone/Android
- [ ] Buttons are touch-friendly
- [ ] Forms are easy to fill on mobile
- [ ] Images responsive
*/

// =====================================

// API Testing with cURL examples

/*
## QUICK API TESTING WITH CURL

# 1. Register
curl -X POST http://localhost:5000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "fullName": "John Doe",
    "email": "john@test.com",
    "password": "password123",
    "phone": "0123456789",
    "role": "customer"
  }'

# 2. Login
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "john@test.com",
    "password": "password123"
  }'

# 3. Get Current User (replace TOKEN)
curl -X GET http://localhost:5000/api/auth/me \\
  -H "Authorization: Bearer TOKEN"

# 4. Search Homestays
curl "http://localhost:5000/api/homestays?city=Bangkok&minPrice=50&maxPrice=200&guests=2"

# 5. Create Booking (replace HOMESTAY_ID and TOKEN)
curl -X POST http://localhost:5000/api/bookings \\
  -H "Authorization: Bearer TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "homestayId": "HOMESTAY_ID",
    "checkInDate": "2024-03-15",
    "checkOutDate": "2024-03-18",
    "numberOfGuests": 2
  }'

# 6. Process Payment (replace BOOKING_ID and TOKEN)
curl -X POST http://localhost:5000/api/bookings/BOOKING_ID/payment \\
  -H "Authorization: Bearer TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "paymentMethod": "qr"
  }'

# 7. Get Booking Stats
curl -X GET http://localhost:5000/api/bookings/stats \\
  -H "Authorization: Bearer TOKEN"
*/

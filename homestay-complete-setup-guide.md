# 🏨 Homestay Management System - Complete Implementation Guide

## 📋 Project Overview

A **production-ready** homestay booking platform with 3 user roles: Customer, Host, and Admin.

**Key Features:**
- ✅ User authentication & role-based access control
- ✅ Homestay listing with search & filters
- ✅ Advanced booking system with date conflict prevention
- ✅ Payment processing (simulated)
- ✅ Review & rating system
- ✅ Admin dashboard for approvals
- ✅ Host dashboard with analytics
- ✅ Email notifications

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express / NestJS
- MongoDB (NoSQL database)
- JWT for authentication
- Cloudinary for image uploads
- Nodemailer for emails
- Redis (optional, for caching)

**Frontend:**
- Next.js 13+ (App Router)
- React 18+
- TailwindCSS
- TypeScript
- SWR for data fetching

## ⚡ Quick Start (10 minutes)

### 1. Backend Setup

```bash
# Create project
mkdir homestay-booking && cd homestay-booking
mkdir backend frontend

# Backend init
cd backend
npm init -y

# Install dependencies
npm install express mongoose cors dotenv bcryptjs jsonwebtoken nodemailer multer cloudinary multer-storage-cloudinary cookie-parser

npm install --save-dev typescript @types/express @types/node ts-node nodemon

# Create .env
cat > .env << 'EOF'
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/homestay
JWT_SECRET=your_super_secret_jwt_key_12345
FRONTEND_URL=http://localhost:3000

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@homestay.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EOF

# Create tsconfig
npx tsc --init

# Start development
npx nodemon --exec ts-node src/server.ts
```

### 2. Frontend Setup

```bash
cd ../frontend

# Create Next.js app
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app

# Install dependencies
npm install axios swr zustand date-fns

# Create .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:5000/api
EOF

# Start development
npm run dev
```

### 3. MongoDB Setup (Local)

```bash
# Using Docker
docker run -d \
  -p 27017:27017 \
  --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:5.0

# Or install locally: https://docs.mongodb.com/manual/installation/
```

## 📊 Database Schema Design

```
User (Người dùng)
├── fullName: string
├── email: string (unique)
├── password: string (hashed)
├── phone: string
├── avatar: string (URL)
├── role: enum['customer', 'host', 'admin']
├── isActive: boolean
├── isBlocked: boolean
└── timestamps

Homestay (Căn nhà)
├── title: string
├── description: string
├── address: string
├── city: string
├── pricePerNight: number
├── maxGuests: number
├── bedrooms: number
├── bathrooms: number
├── amenities: array[string]
├── images: array[string] (Cloudinary URLs)
├── host: ref User
├── isApproved: boolean
├── averageRating: number (0-5)
├── totalReviews: number
└── timestamps

Booking (Đơn đặt phòng)
├── customer: ref User
├── homestay: ref Homestay
├── checkInDate: date
├── checkOutDate: date
├── numberOfGuests: number
├── numberOfNights: number
├── totalPrice: number
├── status: enum['pending', 'confirmed', 'paid', 'cancelled', 'completed']
├── paymentMethod: enum['qr', 'card']
├── paymentProof: string
├── cancellationReason: string
├── cancelledBy: enum['customer', 'host']
└── timestamps

Review (Đánh giá)
├── customer: ref User
├── homestay: ref Homestay
├── booking: ref Booking (unique)
├── rating: number (1-5)
├── comment: string
└── timestamps
```

## 🔐 API Endpoints Cheat Sheet

### Authentication
```
POST   /api/auth/register         - Register
POST   /api/auth/login            - Login
POST   /api/auth/logout           - Logout
GET    /api/auth/me               - Current user
PUT    /api/auth/profile          - Update profile
POST   /api/auth/change-password  - Change password
```

### Homestay
```
GET    /api/homestays             - Search & filter
GET    /api/homestays/:id         - Detail
POST   /api/homestays             - Create (host)
PUT    /api/homestays/:id         - Update (host)
DELETE /api/homestays/:id         - Delete (host)
GET    /api/homestays/host/my-homestays - Host's properties
```

### Booking
```
POST   /api/bookings              - Create booking
POST   /api/bookings/:id/payment  - Process payment
POST   /api/bookings/:id/cancel   - Cancel booking
GET    /api/bookings/my-trips     - Customer's bookings
GET    /api/bookings/host/manage  - Host's bookings
POST   /api/bookings/:id/respond  - Host response
GET    /api/bookings/stats        - Statistics
```

### Review
```
POST   /api/reviews               - Create review
GET    /api/reviews/homestay/:id  - Get reviews
```

### Admin
```
GET    /api/admin/homestays/pending       - Pending approvals
POST   /api/admin/homestays/:id/approve   - Approve
GET    /api/admin/users                   - All users
POST   /api/admin/users/:id/block         - Block user
GET    /api/admin/dashboard               - Dashboard stats
```

## 🎯 Critical Features Implementation

### 1. Date Conflict Prevention (Race Condition Safe)

```typescript
// Use MongoDB transactions to prevent double-booking
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Check availability INSIDE transaction
  const conflict = await Booking.findOne({
    homestay: homestayId,
    status: { $in: ['confirmed', 'paid', 'completed'] },
    checkInDate: { $lt: checkOutDate },
    checkOutDate: { $gt: checkInDate },
  }).session(session);

  if (conflict) throw new Error('Room not available');

  // Create booking
  const booking = await Booking.create([newBooking], { session });
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

### 2. Payment Processing

```typescript
// Simulate payment and update booking status
async processPayment(bookingId, paymentMethod) {
  const booking = await Booking.findById(bookingId);
  
  booking.status = 'paid';
  booking.paymentMethod = paymentMethod;
  await booking.save();

  // Send invoice email
  await emailService.sendInvoiceEmail(booking);
  
  return booking;
}
```

### 3. Auto-Cancel Pending Bookings

```typescript
// Auto-cancel if payment not completed in 15 minutes
setTimeout(async () => {
  const booking = await Booking.findById(bookingId);
  if (booking?.status === 'pending') {
    booking.status = 'cancelled';
    booking.cancellationReason = 'Payment not completed';
    await booking.save();
  }
}, 15 * 60 * 1000);
```

## 🚀 Performance Optimizations

### 1. Database Indexing

```typescript
// Add to models
HomestaySchema.index({ city: 1, isApproved: 1 });
HomestaySchema.index({ host: 1 });
HomestaySchema.index({ pricePerNight: 1 });

BookingSchema.index({ customer: 1, status: 1 });
BookingSchema.index({ homestay: 1, checkInDate: 1, checkOutDate: 1 });
```

### 2. Caching Strategy

```typescript
// Cache frequently accessed data
const cacheKey = `homestay:${homestayId}`;

// Get from cache
let homestay = await redis.get(cacheKey);

if (!homestay) {
  homestay = await Homestay.findById(homestayId);
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(homestay));
}
```

### 3. Query Optimization

```typescript
// Use projection to select only needed fields
const bookings = await Booking.find(
  { customer: customerId },
  'checkInDate checkOutDate totalPrice status' // projection
).lean(); // Return plain objects, not mongoose documents

// Use pagination
const page = 1, limit = 20;
const bookings = await Booking
  .find()
  .skip((page - 1) * limit)
  .limit(limit);
```

### 4. Frontend Optimization

```typescript
// Use SWR for data fetching with caching
const { data, mutate } = useSWR('/api/homestays', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000, // Don't fetch same resource within 1 min
});

// Lazy load components
const HostDashboard = dynamic(() => import('@/components/HostDashboard'), {
  loading: () => <LoadingSpinner />,
});

// Image optimization
<Image
  src={url}
  alt="Homestay"
  width={300}
  height={300}
  priority={isAboveFold}
/>
```

## 🔒 Security Best Practices

### 1. Password Security

```typescript
// Hash with bcrypt (salt rounds = 10)
const hashedPassword = await bcrypt.hash(password, 10);

// Compare when login
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 2. JWT Token Security

```typescript
// Use HttpOnly cookies to prevent XSS
res.cookie('token', jwtToken, {
  httpOnly: true,        // Can't be accessed by JavaScript
  secure: true,          // Only sent over HTTPS
  sameSite: 'strict',    // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

### 3. Input Validation

```typescript
// Validate all inputs before processing
if (!Validators.validateEmail(email)) {
  throw new AppError('Invalid email format', 400);
}

if (!Validators.validatePhone(phone)) {
  throw new AppError('Invalid phone format', 400);
}
```

### 4. CORS Configuration

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

## 📧 Email Templates

The system sends emails for:
1. **Invoice** - When booking is paid
2. **Confirmation** - When host confirms booking
3. **Cancellation** - When booking is cancelled
4. **Notifications** - To host about new bookings

All emails are HTML formatted and include relevant links.

## 🧪 Testing Scenarios

### Test 1: Double Booking Prevention
```
1. Open 2 browser windows (incognito mode)
2. Login with 2 different customer accounts
3. Try to book same room for same dates simultaneously
4. Only first customer should succeed
5. Second customer should get "Room not available" error
```

### Test 2: Role-Based Access Control
```
1. Login as customer
2. Try to access /api/homestays (as host) - should fail
3. Login as host
4. Try to access /api/admin/dashboard - should fail
5. Login as admin - should succeed
```

### Test 3: Payment & Email Flow
```
1. Create booking (status: pending)
2. Process payment (status: paid)
3. Check email inbox for invoice
4. Host receives notification email
```

## 📈 Monitoring & Debugging

```typescript
// Add request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Add performance monitoring
const startTime = Date.now();
// ... do work ...
const duration = Date.now() - startTime;
console.log(`Request took ${duration}ms`);

// Error logging
process.on('unhandledRejection', (err: any) => {
  console.error('Unhandled Rejection:', err);
  // Send alert to admin
});
```

## 🚢 Deployment Checklist

- [ ] Use `.env.production` with secure values
- [ ] Enable HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Configure MongoDB Atlas
- [ ] Set up Cloudinary account
- [ ] Configure email service (Gmail or SendGrid)
- [ ] Enable CORS for production domain only
- [ ] Set secure cookie flags
- [ ] Database backups configured
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic)
- [ ] Load testing done
- [ ] Security audit completed

## 📚 Useful Libraries & Tools

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "nodemailer": "^6.9.0",
    "cloudinary": "^1.32.0",
    "multer": "^1.4.5",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/express": "^4.17.17",
    "@types/node": "^18.15.0",
    "nodemon": "^2.0.20"
  }
}
```

## 🎓 Learning Resources

- MongoDB: https://docs.mongodb.com/
- Express: https://expressjs.com/
- JWT: https://jwt.io/
- Cloudinary: https://cloudinary.com/documentation
- Next.js: https://nextjs.org/docs
- TailwindCSS: https://tailwindcss.com/docs

---

**Ready to launch?** Follow the Quick Start section and you'll have a working application in 10 minutes! 🚀

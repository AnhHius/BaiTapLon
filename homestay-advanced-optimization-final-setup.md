// Advanced Optimization Guide for Homestay System

## 🚀 ADVANCED PERFORMANCE OPTIMIZATION

### 1. Database Optimization

```typescript
// Add comprehensive indexes
homestaySchema.index({ city: 1, isApproved: 1, createdAt: -1 });
homestaySchema.index({ host: 1 });
homestaySchema.index({ pricePerNight: 1 });
homestaySchema.compound('averageRating -1'); // For sorting by rating

// Compound index for booking date range queries
bookingSchema.index({
  homestay: 1,
  status: 1,
  checkInDate: 1,
  checkOutDate: 1,
});

// Text index for full-text search
homestaySchema.index({
  title: 'text',
  description: 'text',
  city: 'text',
});

// Query optimization example
const searchResults = await Homestay.find({
  city: { $regex: searchTerm, $options: 'i' },
  isApproved: true,
  pricePerNight: { $gte: minPrice, $lte: maxPrice },
})
  .select('title city pricePerNight averageRating images[0]') // Projection
  .limit(20)
  .lean() // Return plain objects, not mongoose documents
  .exec();
```

### 2. Caching Strategy with Redis

```typescript
import Redis from 'redis';

const redis = Redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

redis.on('error', (err) => console.log('Redis error:', err));

// Cache patterns
class CacheManager {
  // Cache expiration times
  private readonly TTL = {
    HOMESTAY_DETAIL: 3600, // 1 hour
    SEARCH_RESULTS: 1800,  // 30 minutes
    USER_PROFILE: 7200,    // 2 hours
    BOOKING_STATS: 600,    // 10 minutes
  };

  async getHomestayDetail(homestayId: string) {
    const cacheKey = `homestay:${homestayId}`;
    let data = await redis.get(cacheKey);

    if (!data) {
      data = await Homestay.findById(homestayId);
      await redis.setex(cacheKey, this.TTL.HOMESTAY_DETAIL, JSON.stringify(data));
    } else {
      data = JSON.parse(data);
    }

    return data;
  }

  async invalidateHomestayCache(homestayId: string) {
    await redis.del(`homestay:${homestayId}`);
  }

  async cacheSearchResults(filters: any, results: any) {
    const cacheKey = `search:${JSON.stringify(filters)}`;
    await redis.setex(
      cacheKey,
      this.TTL.SEARCH_RESULTS,
      JSON.stringify(results),
    );
  }
}

export const cacheManager = new CacheManager();
```

### 3. API Optimization

```typescript
// Pagination for large datasets
app.get('/api/homestays', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Homestay.find({ isApproved: true })
      .skip(skip)
      .limit(limit)
      .lean(),
    Homestay.countDocuments({ isApproved: true }),
  ]);

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// Response compression
import compression from 'compression';
app.use(compression());

// Batch API requests
app.post('/api/batch', async (req, res) => {
  const { requests } = req.body;
  const results = await Promise.all(
    requests.map((r) => makeRequest(r)),
  );
  res.json({ results });
});

// Selective field returning (GraphQL-like)
app.get('/api/homestays/:id', async (req, res) => {
  const fields = req.query.fields?.split(',');
  const query = Homestay.findById(req.params.id);
  
  if (fields) {
    query.select(fields.join(' '));
  }
  
  const homestay = await query;
  res.json(homestay);
});
```

### 4. Frontend Optimization

```typescript
// Image Optimization
import Image from 'next/image';

// Use Next.js Image for automatic optimization
<Image
  src={homestay.images[0]}
  alt={homestay.title}
  width={400}
  height={300}
  priority={isAboveFold}
  placeholder="blur"
  blurDataURL="data:image/png;base64,..." // Low quality image placeholder
/>

// Lazy loading images
<Image
  src={url}
  alt="description"
  loading="lazy"
/>

// Code Splitting
import dynamic from 'next/dynamic';

const HostDashboard = dynamic(
  () => import('@/components/HostDashboard'),
  {
    loading: () => <Skeleton />,
    ssr: false, // Don't render on server
  },
);

// Font Optimization
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Show fallback while loading
  preload: true,
});

// Bundle Analysis
// Add @next/bundle-analyzer
// ANALYZE=true npm run build

// Memoization
import { useMemo } from 'react';

const memoizedResults = useMemo(
  () => processingFunction(data),
  [data], // Re-calculate only if data changes
);

// Virtual Scrolling for large lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={1000}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  )}
</FixedSizeList>
```

### 5. Connection Pooling

```typescript
// MongoDB Connection Pooling
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,   // Maximum connections
  minPoolSize: 5,    // Minimum connections
  maxIdleTimeMS: 30000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  retryWrites: true,
  w: 'majority',
});

// Express connection pool
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

### 6. Query Performance Monitoring

```typescript
// Log slow queries
mongoose.set('debug', (collection, method, query, result, options) => {
  const duration = options.duration;
  
  if (duration > 100) {
    console.warn(`[SLOW QUERY] ${collection}.${method}`);
    console.warn('Query:', query);
    console.warn('Duration:', duration + 'ms');
    
    // Send alert to monitoring service
    alertService.sendSlowQuery({
      collection,
      method,
      duration,
      query,
    });
  }
});

// Use MongoDB's explain() to analyze queries
const explain = await Homestay.find({ city: 'Bangkok' }).explain('executionStats');
console.log(explain.executionStats);
// Check if using index, number of documents scanned
```

---

## 📦 FINAL PROJECT SETUP - STEP BY STEP

### Prerequisites
```bash
Node.js 18+
npm or yarn
MongoDB (local or Atlas)
Cloudinary account (free tier works)
Gmail account for emails
```

### Complete Setup (5-10 minutes)

```bash
# 1. Create project structure
mkdir homestay-booking && cd homestay-booking
mkdir backend frontend

# ============ BACKEND SETUP ============
cd backend

# Initialize project
npm init -y

# Install all dependencies
npm install \
  express \
  mongoose \
  cors \
  dotenv \
  bcryptjs \
  jsonwebtoken \
  nodemailer \
  multer \
  cloudinary \
  multer-storage-cloudinary \
  cookie-parser \
  compression

npm install --save-dev \
  typescript \
  @types/express \
  @types/node \
  ts-node \
  nodemon \
  @types/bcryptjs \
  @types/jsonwebtoken

# Create directory structure
mkdir -p src/{models,services,controllers,routes,middlewares,utils}
mkdir -p tests

# Create tsconfig.json
npx tsc --init

# Update tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/homestay
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long_change_in_prod
FRONTEND_URL=http://localhost:3000

EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@homestay.com

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

LOG_LEVEL=debug
EOF

# Update package.json scripts
cat >> package.json << 'EOF'
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/src/server.js",
    "dev": "nodemon --exec ts-node src/server.ts",
    "test": "jest",
    "lint": "eslint src"
  }
}
EOF

# ============ FRONTEND SETUP ============
cd ../frontend

# Create Next.js app
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-git \
  --no-src-dir

# Install additional dependencies
npm install \
  axios \
  swr \
  zustand \
  date-fns \
  recharts

# Create .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME=Homestay Booking Platform
EOF

# Create directory structure
mkdir -p {services,hooks,types,utils,middleware}

# ============ DATABASE SETUP ============

# Option A: Using Docker
docker run -d \
  -p 27017:27017 \
  --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:5.0

# Option B: Using local MongoDB
# Follow: https://docs.mongodb.com/manual/installation/

# ============ START DEVELOPMENT ============

# Terminal 1: Backend
cd backend
npm run dev
# Runs on http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev
# Runs on http://localhost:3000

# ============ VERIFY SETUP ============

# Test backend API
curl http://localhost:5000/api/auth/me

# Test frontend
open http://localhost:3000
```

---

## 🎯 NEXT STEPS AFTER SETUP

1. **Copy Code Files**
   - Copy all `.ts` files from outputs to backend/src
   - Copy all `.tsx` files from outputs to frontend/app

2. **Configure Services**
   - Create Cloudinary account: https://cloudinary.com
   - Setup Gmail App Password: https://myaccount.google.com/apppasswords
   - Create MongoDB Atlas cluster: https://www.mongodb.com/cloud/atlas

3. **Test Core Features**
   - Register as customer
   - Register as host
   - Create and list homestays
   - Test booking flow
   - Verify email notifications

4. **Run Tests**
   ```bash
   cd backend
   npm test
   ```

5. **Build for Production**
   ```bash
   # Backend
   npm run build
   
   # Frontend
   npm run build
   ```

6. **Deploy**
   - Follow deployment guide in `homestay-deployment-guide.md`

---

## 📚 ALL FILES YOU NEED

Here's a checklist of all files provided:

Backend Files:
- [ ] homestay-backend-models.ts
- [ ] homestay-auth-service.ts
- [ ] homestay-booking-service.ts
- [ ] homestay-services.ts (Homestay & Review)
- [ ] homestay-email-error-utils.ts
- [ ] homestay-controllers-routes.ts
- [ ] homestay-middleware-frontend-setup.ts (Middleware + initial components)

Frontend Files:
- [ ] homestay-frontend-pages-hooks.tsx
- [ ] homestay-api-client-hooks.ts

Documentation:
- [ ] homestay-complete-setup-guide.md
- [ ] homestay-testing-guide.ts
- [ ] homestay-deployment-guide.md
- [ ] This file (Advanced Optimization & Setup)

---

## 🆘 TROUBLESHOOTING

### MongoDB Connection Error
```bash
# Check if MongoDB is running
mongosh # or mongo command

# If using Docker:
docker ps | grep mongodb
```

### Port Already in Use
```bash
# Kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

### Email Not Sending
```
1. Verify Gmail App Password created
2. Enable "Less secure app access" temporarily
3. Check SMTP settings in .env
4. Look at console logs for nodemailer errors
```

### Image Upload Failing
```
1. Verify Cloudinary credentials
2. Check file size < 5MB
3. Ensure file is image format
4. Check folder exists in Cloudinary dashboard
```

### JWT Token Issues
```
1. Ensure JWT_SECRET is set in .env
2. Check token not expired (7 days)
3. Clear localStorage and login again
4. Verify Authorization header format: "Bearer TOKEN"
```

---

## 📞 SUPPORT & LEARNING RESOURCES

- MongoDB Docs: https://docs.mongodb.com
- Express Docs: https://expressjs.com
- Next.js Docs: https://nextjs.org/docs
- TailwindCSS: https://tailwindcss.com
- SWR (Data fetching): https://swr.vercel.app
- Cloudinary Docs: https://cloudinary.com/documentation
- Nodemailer: https://nodemailer.com

---

## 🎓 LEARNING CHECKLIST

After setup, learn these concepts in order:

1. **Authentication & JWT**
   - How JWT tokens work
   - Token expiration and refresh
   - Secure cookie storage

2. **Database Transactions**
   - Race condition prevention
   - Transaction rollback

3. **API Design**
   - RESTful principles
   - Error handling
   - Status codes

4. **Security**
   - Password hashing
   - CORS
   - Input validation
   - XSS/CSRF protection

5. **Performance**
   - Caching strategies
   - Database indexing
   - Query optimization

6. **Deployment**
   - Docker containerization
   - CI/CD pipelines
   - Monitoring & logging

---

**Ready to launch? Start with the Quick Start section and you'll have a fully functional homestay booking platform running in minutes! 🚀**

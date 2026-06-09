// Production Deployment Guide for Homestay System

## 🚀 DEPLOYMENT STRATEGIES

### Option 1: Docker + Docker Compose (Recommended for quick setup)

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    container_name: homestay_mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: securepassword123
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: homestay_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: homestay_backend
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://admin:securepassword123@mongodb:27017/homestay
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      EMAIL_USER: ${EMAIL_USER}
      EMAIL_PASSWORD: ${EMAIL_PASSWORD}
      CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}
      CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY}
      CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/src:/app/src
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${FRONTEND_API_URL}
    container_name: homestay_frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: ${FRONTEND_API_URL}
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
```

### Option 2: Cloud Deployment (Vercel + Heroku/Railway)

**Frontend (Vercel):**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel deploy --prod

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_API_URL=https://your-api-url.com/api
```

**Backend (Railway or Heroku):**
```bash
# Using Railway (recommended)
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up

# Or using Heroku
heroku login
heroku create your-app-name
git push heroku main
```

### Option 3: AWS EC2 + Nginx

```bash
# 1. Launch EC2 instance (Ubuntu 22.04)

# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# 3. Update system
sudo apt update && sudo apt upgrade -y

# 4. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 5. Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt install -y mongodb-org
sudo systemctl start mongod

# 6. Install Redis
sudo apt install -y redis-server
sudo systemctl start redis-server

# 7. Clone repository
git clone your-repo-url
cd homestay-booking

# 8. Setup backend
cd backend
npm install
cp .env.production .env
npm run build
npm install -g pm2
pm2 start npm --name "homestay-backend" -- start

# 9. Setup frontend
cd ../frontend
npm install
npm run build
pm2 start npm --name "homestay-frontend" -- start

# 10. Setup Nginx as reverse proxy
sudo apt install -y nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/homestay > /dev/null << 'EOF'
upstream backend {
  server localhost:5000;
}

upstream frontend {
  server localhost:3000;
}

server {
  listen 80;
  server_name your-domain.com;

  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate /path/to/certificate.crt;
  ssl_certificate_key /path/to/private.key;

  # API routes
  location /api {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Frontend
  location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  # Cache static files
  location /_next/static {
    proxy_pass http://frontend;
    expires 365d;
    add_header Cache-Control "public, immutable";
  }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/homestay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 11. Setup SSL with Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com

# 12. Save PM2 startup
pm2 startup
pm2 save
```

---

## 📋 PRODUCTION ENVIRONMENT VARIABLES

```bash
# backend/.env.production

NODE_ENV=production
PORT=5000

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/homestay?retryWrites=true&w=majority

# Redis (Redis Cloud)
REDIS_URL=redis://:password@hostname:port

# JWT
JWT_SECRET=your-extremely-long-and-secure-random-string-here-min-32-chars

# Frontend
FRONTEND_URL=https://your-domain.com

# Email (SendGrid recommended for production)
EMAIL_SERVICE=sendgrid
EMAIL_USER=sendgrid
EMAIL_PASSWORD=SG.your-sendgrid-api-key
EMAIL_FROM=noreply@your-domain.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🔐 PRODUCTION SECURITY CHECKLIST

```markdown
## Security Audit

### HTTPS & TLS
- [ ] SSL certificate installed (Let's Encrypt or commercial)
- [ ] HTTPS enforced (all HTTP redirects to HTTPS)
- [ ] HSTS header configured (Strict-Transport-Security)
- [ ] TLS 1.2+ minimum

### Database Security
- [ ] MongoDB authentication enabled
- [ ] Database user has limited permissions
- [ ] Database backups automated (daily)
- [ ] Backup encryption enabled
- [ ] IP whitelist configured for MongoDB

### API Security
- [ ] CORS properly configured (only allow your domain)
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL/NoSQL injection prevention
- [ ] XSS protection headers set
- [ ] CSRF protection enabled
- [ ] API keys/secrets not in version control

### Authentication
- [ ] JWT secret is strong (32+ characters)
- [ ] JWT expiration set (7 days recommended)
- [ ] Refresh token strategy implemented
- [ ] Password hashing with bcrypt (salt rounds: 10+)
- [ ] Account lockout after failed attempts
- [ ] Email verification for new accounts

### File Upload Security
- [ ] File type validation (only images)
- [ ] File size limits (5MB max)
- [ ] Malware scan on upload
- [ ] Files stored outside web root
- [ ] Cloudinary security token validation

### Monitoring & Logging
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic)
- [ ] Application logs stored securely
- [ ] Database logs monitored
- [ ] Alerts configured for errors/failures

### Infrastructure
- [ ] Firewall configured
- [ ] Only necessary ports open
- [ ] SSH key-based auth (no password)
- [ ] Regular security patches applied
- [ ] Docker images scanned for vulnerabilities
- [ ] Environment variables not in Docker images

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] Sensitive data encrypted in transit
- [ ] User passwords never logged
- [ ] Payment information never stored
- [ ] GDPR compliance (if EU users)
- [ ] Privacy policy displayed
```

---

## 📊 MONITORING & PERFORMANCE

```javascript
// backend/src/utils/monitoring.ts

import Sentry from '@sentry/node';
import StatsD from 'node-statsd';

// Initialize Sentry error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Initialize StatsD for metrics
const statsD = new StatsD();

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    statsD.timing(`request.${req.method}.${req.path}`, duration);
    
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});

// Database query monitoring
mongoose.set('debug', (collection, method, query, result, options) => {
  const duration = options.duration;
  if (duration > 100) {
    console.warn(`Slow query: ${collection}.${method} took ${duration}ms`);
    statsD.timing('mongodb.query', duration);
  }
});

// Error tracking
process.on('unhandledRejection', (error) => {
  Sentry.captureException(error);
  console.error('Unhandled rejection:', error);
});
```

---

## 🔄 CI/CD PIPELINE (GitHub Actions)

```yaml
# .github/workflows/deploy.yml

name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend && npm install
          cd ../frontend && npm install
      
      - name: Run tests
        run: |
          cd backend && npm test
          cd ../frontend && npm test
      
      - name: Build
        run: |
          cd backend && npm run build
          cd ../frontend && npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no root@$DEPLOY_HOST "cd /app && git pull && docker-compose up -d"
```

---

## 📈 PERFORMANCE OPTIMIZATION FOR PRODUCTION

```typescript
// Redis Caching Strategy
const cacheKey = `homestay:search:${JSON.stringify(filters)}`;
let results = await redis.get(cacheKey);

if (!results) {
  results = await Homestay.find(query);
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(results));
}

// Database connection pooling
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 5,
});

// API response compression
app.use(compression());

// Static file caching headers
app.use(express.static('public', {
  maxAge: '1d',
  etag: false,
}));

// Image optimization
const IMAGES_CACHE_TIME = 7 * 24 * 60 * 60; // 7 days
```

---

## 🆘 ROLLBACK & RECOVERY PROCEDURES

```bash
# If deployment fails:

# 1. Check logs
docker-compose logs backend
docker-compose logs frontend

# 2. Rollback to previous version
git revert HEAD
docker-compose down
docker-compose up -d

# 3. Database recovery
# Restore from backup
mongorestore --uri "mongodb://admin:password@localhost:27017/homestay" /path/to/backup

# 4. Verify system health
curl -s https://your-domain.com/api/health
```


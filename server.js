const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Security middleware
const { securityMiddleware, corsConfig } = require('./middleware/securityHeaders');
const { sanitizeInputs, xssProtection, trimInputs, validateContentType } = require('./middleware/inputSanitizer');

const app = express();

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// ============================================
// SECURITY MIDDLEWARE STACK
// ============================================

// 1. Security Headers (Helmet, Request ID, etc.)
app.use(securityMiddleware);

// 2. CORS with whitelist and credentials
app.use(cors({
  ...corsConfig,
  credentials: true // Allow cookies to be sent cross-origin
}));

// 3. Cookie parser for HTTP-only cookies
app.use(cookieParser());

// 4. Body parsers with size limits
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4.5. Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. Content type validation
app.use(validateContentType);

// 6. Trim whitespace from inputs
app.use(trimInputs);

// 7. Sanitize inputs (NoSQL injection prevention)
app.use(sanitizeInputs);

// 8. XSS Protection
app.use(xssProtection);

// ============================================
// DATABASE CONNECTION
// ============================================

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/dormaxis';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    if (err.name === 'MongooseServerSelectionError') {
      console.error('TIP: Check if your MongoDB service is running and accessible on 127.0.0.1:27017');
    }
  });

// ============================================
// ROUTES
// ============================================

const homeRoutes = require('./routes/homeRoutes');
const dormRoutes = require('./routes/dormRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const mfaRoutes = require('./routes/mfaRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Rate limiting middleware
const { loginLimiter, apiLimiter, ipBlockingMiddleware } = require('./middleware/rateLimiter');

// Apply IP blocking check globally
app.use(ipBlockingMiddleware);

// Base routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Dormaxis API',
    version: '1.0.0',
    security: 'enabled'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// API Routes with rate limiting
app.use('/api/home', homeRoutes);
app.use('/api/dorms', dormRoutes);
app.use('/api/auth/login', loginLimiter); // Rate limit login endpoint
app.use('/api/auth', authRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    requestId: req.requestId
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${req.requestId}] Error:`, err.stack);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({ 
    success: false,
    error: isDevelopment ? err.message : 'Something went wrong!',
    requestId: req.requestId,
    ...(isDevelopment && { stack: err.stack })
  });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Security middleware: ENABLED`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
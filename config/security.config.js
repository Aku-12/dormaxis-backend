/**
 * Security Configuration for DormAxis
 * Contains all security-related settings and policies
 */

module.exports = {
  // Password Policy
  password: {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    expiryDays: 90,          // Password expires after 90 days
    warningDays: 14,         // Warn user 14 days before expiry
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  },

  // Password Strength Levels
  strengthLevels: {
    0: { label: 'Very Weak', color: '#dc2626' },    // red
    1: { label: 'Weak', color: '#ea580c' },          // orange
    2: { label: 'Fair', color: '#ca8a04' },          // yellow
    3: { label: 'Strong', color: '#16a34a' },        // green
    4: { label: 'Very Strong', color: '#059669' },   // emerald
  },

  // Session Configuration
  session: {
    jwtExpiry: '15m',           // Access token expires in 15 minutes
    refreshExpiry: '7d',        // Refresh token expires in 7 days
    maxConcurrentSessions: 3,   // Max active sessions per user
    idleTimeout: 15 * 60 * 1000, // 15 minutes idle timeout
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000,   // 15 minutes
    maxRequests: 100,           // Max requests per window
    loginMaxAttempts: 5,        // Max login attempts before lockout
    lockoutDuration: 30 * 60 * 1000, // 30 minutes lockout
  },

  // CORS Configuration
  cors: {
    allowedOrigins: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'https://dormaxis.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-User-Role'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.google.com', 'https://www.gstatic.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://rc.esewa.com.np', 'https://esewa.com.np'],
      frameSrc: ["'self'", 'https://www.google.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // Security Headers
  headers: {
    hsts: {
      maxAge: 31536000,          // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  },

  // Encryption settings
  encryption: {
    bcryptRounds: 12,
    aesAlgorithm: 'aes-256-gcm',
  },
};

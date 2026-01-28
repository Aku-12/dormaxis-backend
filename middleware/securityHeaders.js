/**
 * Security Headers Middleware
 * Configures Helmet.js and other security headers
 */

const helmet = require('helmet');
const crypto = require('crypto');
const securityConfig = require('../config/security.config');

/**
 * Configure Helmet with security headers
 */
const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://rc.esewa.com.np", "https://esewa.com.np", "http://localhost:*", "http://127.0.0.1:*", "http://192.168.1.72:*"],
      frameSrc: ["'self'", "https://www.google.com", "https://rc.esewa.com.np"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: securityConfig.headers.hsts.maxAge,
    includeSubDomains: securityConfig.headers.hsts.includeSubDomains,
    preload: securityConfig.headers.hsts.preload,
  },

  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // Prevent MIME type sniffing
  noSniff: true,

  // XSS filter
  xssFilter: true,

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // Referrer Policy
  referrerPolicy: {
    policy: securityConfig.headers.referrerPolicy,
  },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: {
    policy: 'same-origin',
  },
});

/**
 * Add request ID for request tracing
 */
const requestIdMiddleware = (req, res, next) => {
  const requestId = req.get('X-Request-ID') || crypto.randomUUID();
  req.requestId = requestId;
  res.set('X-Request-ID', requestId);
  next();
};

/**
 * Add additional security headers not covered by Helmet
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Permissions Policy (formerly Feature Policy)
  res.set('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(self), usb=()');

  // Cache Control for sensitive endpoints
  if (req.path.includes('/auth') || req.path.includes('/profile')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  }

  // X-Content-Type-Options
  res.set('X-Content-Type-Options', 'nosniff');

  // X-Download-Options (for IE)
  res.set('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies
  res.set('X-Permitted-Cross-Domain-Policies', 'none');

  next();
};

/**
 * CORS configuration with whitelist
 */
const corsConfig = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // DEBUG: Log origin for troubleshooting
    console.log(`[CORS Check] Origin: "${origin}"`);
    console.log(`[CORS Check] Allowed:`, securityConfig.cors.allowedOrigins);

    if (securityConfig.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin: "${origin}" is not in whitelist`);
      // Use null, false to allow request but without CORS headers (standard behavior)
      callback(null, false);
    }
  },
  methods: securityConfig.cors.methods,
  allowedHeaders: securityConfig.cors.allowedHeaders,
  credentials: securityConfig.cors.credentials,
  maxAge: securityConfig.cors.maxAge,
  optionsSuccessStatus: 200,
};

/**
 * Combined security middleware stack
 */
const securityMiddleware = [
  requestIdMiddleware,
  helmetConfig,
  additionalSecurityHeaders,
];

module.exports = {
  helmetConfig,
  requestIdMiddleware,
  additionalSecurityHeaders,
  corsConfig,
  securityMiddleware,
};

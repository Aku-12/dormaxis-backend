const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Configurations
 * Protects against brute-force attacks and API abuse
 */

// Store for tracking blocked IPs (in-memory, use Redis in production)
const blockedIPs = new Map();

/**
 * Check if IP is blocked
 */
const isIPBlocked = (ip) => {
  const blocked = blockedIPs.get(ip);
  if (blocked && blocked.until > Date.now()) {
    return true;
  }
  if (blocked && blocked.until <= Date.now()) {
    blockedIPs.delete(ip);
  }
  return false;
};

/**
 * Block an IP temporarily
 */
const blockIP = (ip, durationMs = 30 * 60 * 1000) => {
  blockedIPs.set(ip, {
    until: Date.now() + durationMs,
    blockedAt: new Date()
  });
};

/**
 * IP Blocking Middleware
 * Blocks IPs that have been flagged for abuse
 */
const ipBlockingMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (isIPBlocked(ip)) {
    const blocked = blockedIPs.get(ip);
    const remainingMs = blocked.until - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    
    return res.status(429).json({
      success: false,
      error: `Your IP has been temporarily blocked due to suspicious activity. Try again in ${remainingMin} minutes.`,
      retryAfter: Math.ceil(remainingMs / 1000)
    });
  }
  
  next();
};

/**
 * Login Rate Limiter
 * 5 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }, // Disable IPv6 validation warning
  handler: (req, res, next, options) => {
    // Track failed attempts for IP blocking
    const ip = req.ip;
    const failedAttempts = req.rateLimit?.current || 0;
    
    // Block IP after 20 consecutive failures across multiple windows
    if (failedAttempts >= 5) {
      // Increment IP failure counter
      const ipFailures = (blockedIPs.get(`failures_${ip}`)?.count || 0) + 1;
      blockedIPs.set(`failures_${ip}`, { count: ipFailures, lastAttempt: Date.now() });
      
      if (ipFailures >= 4) { // 4 windows × 5 attempts = 20 total failures
        blockIP(ip, 60 * 60 * 1000); // Block for 1 hour
        blockedIPs.delete(`failures_${ip}`);
      }
    }
    
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for authenticated admins
    return req.user?.role === 'admin' || req.user?.role === 'superadmin';
  }
});

/**
 * Strict Rate Limiter for sensitive operations
 * 3 attempts per 5 minutes
 */
const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 attempts
  message: {
    success: false,
    error: 'Too many attempts. Please try again after 5 minutes.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Password Reset Rate Limiter
 * 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again after 1 hour.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter,
  apiLimiter,
  strictLimiter,
  passwordResetLimiter,
  ipBlockingMiddleware,
  blockIP,
  isIPBlocked
};

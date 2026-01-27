const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// Session configuration
const SESSION_CONFIG = {
  idleTimeout: 15 * 60 * 1000,      // 15 minutes idle timeout
  maxSession: 8 * 60 * 60 * 1000,   // 8 hours max session
  maxConcurrentSessions: 3,          // Max 3 active sessions per user
  cookieName: 'dormaxis_token'
};

/**
 * Cookie configuration for HTTP-only secure cookies
 */
const getCookieOptions = (maxAge = SESSION_CONFIG.maxSession) => ({
  httpOnly: true,                    // Prevents JavaScript access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Lax for dev, Strict for prod
  maxAge: maxAge,                    // Cookie lifetime
  path: '/'
});

/**
 * Protect routes - verify JWT token from cookie or header
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // First check for token in HTTP-only cookie
    if (req.cookies && req.cookies[SESSION_CONFIG.cookieName]) {
      token = req.cookies[SESSION_CONFIG.cookieName];
    }
    // Fallback to Authorization header (for API clients)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, no token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session exists and is valid
    const session = await Session.findOne({ token, userId: decoded.id });
    
    if (!session) {
      // Clear invalid cookie
      res.clearCookie(SESSION_CONFIG.cookieName, getCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid'
      });
    }

    // Check if session is expired (idle or max)
    if (session.isExpired()) {
      await session.deleteOne();
      res.clearCookie(SESSION_CONFIG.cookieName, getCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'Session expired due to inactivity'
      });
    }

    // Update last activity (touch session)
    await session.touch();

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, user not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Attach user and session to request object
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.clearCookie(SESSION_CONFIG.cookieName, getCookieOptions());
    return res.status(401).json({
      success: false,
      error: 'Not authorized, token invalid'
    });
  }
};

/**
 * Admin only middleware
 */
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
};

/**
 * Generate JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '8h' // Match max session duration
  });
};

/**
 * Create session and set cookie
 */
const createSession = async (res, user, req) => {
  const token = generateToken(user._id);
  
  // Check concurrent session limit
  const activeCount = await Session.getActiveSessionCount(user._id);
  
  if (activeCount >= SESSION_CONFIG.maxConcurrentSessions) {
    // Remove oldest session to make room
    await Session.removeOldestSession(user._id);
    console.log(`Removed oldest session for user ${user._id} (limit: ${SESSION_CONFIG.maxConcurrentSessions})`);
  }

  // Create new session record
  const session = await Session.create({
    userId: user._id,
    token,
    userAgent: req.get('User-Agent') || '',
    ipAddress: req.ip || req.connection.remoteAddress,
    expiresAt: new Date(Date.now() + SESSION_CONFIG.maxSession)
  });

  // Set HTTP-only cookie
  res.cookie(SESSION_CONFIG.cookieName, token, getCookieOptions());

  return { token, sessionId: session._id };
};

/**
 * Clear session and cookie
 */
const clearSession = async (res, token) => {
  if (token) {
    await Session.deleteOne({ token });
  }
  res.clearCookie(SESSION_CONFIG.cookieName, getCookieOptions());
};

module.exports = {
  protect,
  adminOnly,
  generateToken,
  createSession,
  clearSession,
  SESSION_CONFIG,
  getCookieOptions
};

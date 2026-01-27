/**
 * Google reCAPTCHA v3 Verification Middleware
 * Verifies reCAPTCHA tokens sent from the frontend
 */

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// Minimum score threshold (0.0 - 1.0)
// 0.5 is recommended for most use cases
// Lower scores indicate more likely bot activity
const SCORE_THRESHOLD = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD) || 0.5;

/**
 * Verify reCAPTCHA token with Google
 * @param {string} token - The reCAPTCHA token from frontend
 * @param {string} remoteip - Client IP address (optional)
 * @returns {Promise<{success: boolean, score?: number, action?: string, error?: string}>}
 */
const verifyRecaptchaToken = async (token, remoteip = null) => {
  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
    });

    if (remoteip) {
      params.append('remoteip', remoteip);
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    return {
      success: data.success,
      score: data.score,
      action: data.action,
      challengeTimestamp: data.challenge_ts,
      hostname: data.hostname,
      errorCodes: data['error-codes'],
    };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: false,
      error: 'Failed to verify reCAPTCHA',
    };
  }
};

/**
 * Middleware to verify reCAPTCHA token
 * @param {string} expectedAction - The expected action name (e.g., 'login', 'register')
 * @param {Object} options - Configuration options
 * @param {boolean} options.required - Whether reCAPTCHA is required (default: true in production)
 * @param {number} options.minScore - Minimum acceptable score (default: SCORE_THRESHOLD)
 */
const verifyRecaptcha = (expectedAction, options = {}) => {
  return async (req, res, next) => {
    // Skip verification if secret key is not configured (development mode)
    if (!RECAPTCHA_SECRET_KEY) {
      console.warn('reCAPTCHA secret key not configured, skipping verification');
      return next();
    }

    const {
      required = process.env.NODE_ENV === 'production',
      minScore = SCORE_THRESHOLD
    } = options;

    const recaptchaToken = req.body.recaptchaToken || req.headers['x-recaptcha-token'];

    // If token is not provided
    if (!recaptchaToken) {
      if (required) {
        return res.status(400).json({
          success: false,
          error: 'reCAPTCHA verification required',
          code: 'RECAPTCHA_MISSING',
        });
      }
      // Not required, continue without verification
      return next();
    }

    // Get client IP
    const clientIP = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'];

    // Verify the token
    const result = await verifyRecaptchaToken(recaptchaToken, clientIP);

    if (!result.success) {
      console.warn('reCAPTCHA verification failed:', result.errorCodes);
      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        code: 'RECAPTCHA_FAILED',
      });
    }

    // Check action matches (if specified)
    if (expectedAction && result.action !== expectedAction) {
      console.warn(`reCAPTCHA action mismatch: expected ${expectedAction}, got ${result.action}`);
      return res.status(400).json({
        success: false,
        error: 'reCAPTCHA verification failed',
        code: 'RECAPTCHA_ACTION_MISMATCH',
      });
    }

    // Check score threshold
    if (result.score < minScore) {
      console.warn(`reCAPTCHA score too low: ${result.score} < ${minScore}`);
      return res.status(400).json({
        success: false,
        error: 'Request blocked due to suspicious activity',
        code: 'RECAPTCHA_LOW_SCORE',
      });
    }

    // Attach reCAPTCHA result to request for logging/analytics
    req.recaptcha = {
      score: result.score,
      action: result.action,
      hostname: result.hostname,
    };

    next();
  };
};

/**
 * Pre-configured middleware for common actions
 */
const recaptchaMiddleware = {
  login: verifyRecaptcha('login'),
  register: verifyRecaptcha('register'),
  forgotPassword: verifyRecaptcha('forgot_password'),
  contact: verifyRecaptcha('contact'),
  booking: verifyRecaptcha('booking'),

  // Custom action with options
  custom: verifyRecaptcha,
};

module.exports = {
  verifyRecaptcha,
  verifyRecaptchaToken,
  recaptchaMiddleware,
};

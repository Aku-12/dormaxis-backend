const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  changePassword,
  logout,
  validatePassword,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  updateProfile,
  uploadAvatarHandler,
  deleteAvatar,
  getSessions,
  revokeSession,
  revokeAllSessions,
  googleLogin,
  deleteAccount
} = require('../controllers/authController');
const {
  getGoogleAuthUrl,
  googleCallback
} = require('../controllers/oauthController');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  getPasswordRequirementsInfo
} = require('../validators/authValidators');
const { protect } = require('../middleware/authMiddleware');
const { passwordResetLimiter } = require('../middleware/rateLimiter');
const { uploadAvatar } = require('../middleware/uploadMiddleware');
const { recaptchaMiddleware } = require('../middleware/recaptchaMiddleware');

// Public routes
// POST /api/auth/register - Register new user
router.post('/register', recaptchaMiddleware.register, registerValidation, register);

// POST /api/auth/login - Login user
router.post('/login', recaptchaMiddleware.login, loginValidation, login);

// POST /api/auth/google - Google Login (legacy ID token method)
router.post('/google', googleLogin);

// Google OAuth 2.0 with PKCE routes
// GET /api/auth/google/url - Get Google OAuth URL
router.get('/google/url', getGoogleAuthUrl);

// POST /api/auth/google/callback - Handle OAuth callback
router.post('/google/callback', googleCallback);

// POST /api/auth/validate-password - Validate password strength (for real-time feedback)
router.post('/validate-password', validatePassword);

// GET /api/auth/password-requirements - Get password requirements
router.get('/password-requirements', getPasswordRequirementsInfo);

// Password Reset routes (rate limited)
// POST /api/auth/forgot-password - Request password reset code
router.post('/forgot-password', recaptchaMiddleware.forgotPassword, passwordResetLimiter, forgotPassword);

// POST /api/auth/verify-reset-code - Verify the reset code
router.post('/verify-reset-code', verifyResetCode);

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', resetPassword);

// Protected routes (require authentication)
// GET /api/auth/profile - Get user profile
router.get('/profile', protect, getProfile);

// POST /api/auth/change-password - Change password
router.post('/change-password', protect, changePasswordValidation, changePassword);

// POST /api/auth/logout - Logout user
router.post('/logout', logout);

// PUT /api/auth/profile - Update user profile
router.put('/profile', protect, updateProfile);

// POST /api/auth/avatar - Upload avatar
router.post('/avatar', protect, (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload failed'
      });
    }
    next();
  });
}, uploadAvatarHandler);

// DELETE /api/auth/avatar - Delete avatar
router.delete('/avatar', protect, deleteAvatar);

// Session Management Routes
router.get('/sessions', protect, getSessions);
router.delete('/sessions', protect, revokeAllSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);

// DELETE /api/auth/account - Delete user account
router.delete('/account', protect, deleteAccount);

module.exports = router;

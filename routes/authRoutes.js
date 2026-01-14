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
  resetPassword
} = require('../controllers/authController');
const { 
  registerValidation, 
  loginValidation, 
  changePasswordValidation,
  getPasswordRequirementsInfo 
} = require('../validators/authValidators');
const { protect } = require('../middleware/authMiddleware');
const { passwordResetLimiter } = require('../middleware/rateLimiter');

// Public routes
// POST /api/auth/register - Register new user
router.post('/register', registerValidation, register);

// POST /api/auth/login - Login user
router.post('/login', loginValidation, login);

// POST /api/auth/validate-password - Validate password strength (for real-time feedback)
router.post('/validate-password', validatePassword);

// GET /api/auth/password-requirements - Get password requirements
router.get('/password-requirements', getPasswordRequirementsInfo);

// Password Reset routes (rate limited)
// POST /api/auth/forgot-password - Request password reset code
router.post('/forgot-password', passwordResetLimiter, forgotPassword);

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

module.exports = router;


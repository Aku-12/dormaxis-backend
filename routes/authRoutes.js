const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  logout
} = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../validators/authValidators');
const { protect } = require('../middleware/authMiddleware');

// POST /api/auth/register - Register new user
router.post('/register', registerValidation, register);

// POST /api/auth/login - Login user
router.post('/login', loginValidation, login);

// GET /api/auth/profile - Get user profile (protected)
router.get('/profile', protect, getProfile);

// POST /api/auth/logout - Logout user
router.post('/logout', logout);

module.exports = router;

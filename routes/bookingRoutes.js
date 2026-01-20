const express = require('express');
const router = express.Router();
const {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  validatePromoCode,
  getBookingPreview,
  getAllBookings,
  updateBookingStatus
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminAuth');
const {
  createBookingValidation,
  validatePromoCodeValidation,
  updateBookingStatusValidation
} = require('../validators/bookingValidators');

// Public route (but needs auth for user-specific pricing)
router.get('/preview', protect, getBookingPreview);

// Protected user routes
router.post('/', protect, createBookingValidation, createBooking);
router.get('/', protect, getUserBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, cancelBooking);

// Promo code validation
router.post('/validate-promo', protect, validatePromoCodeValidation, validatePromoCode);

// Admin routes
router.get('/admin/all', protect, adminAuth, getAllBookings);
router.put('/admin/:id/status', protect, adminAuth, updateBookingStatusValidation, updateBookingStatus);

module.exports = router;

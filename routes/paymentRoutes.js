const express = require('express');
const router = express.Router();
const {
  initiateEsewaPayment,
  verifyEsewaPayment,
  checkPaymentStatus,
  handlePaymentFailure,
  getPaymentDetails,
  // Khalti controllers
  initiateKhaltiPaymentController,
  verifyKhaltiPaymentController,
  checkKhaltiPaymentStatus
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// ============================================
// ESEWA ROUTES
// ============================================

/**
 * @route   POST /api/payments/esewa/initiate
 * @desc    Initiate eSewa payment for a booking
 * @access  Private
 */
router.post('/esewa/initiate', initiateEsewaPayment);

/**
 * @route   POST /api/payments/esewa/verify
 * @desc    Verify eSewa payment after redirect
 * @access  Private
 */
router.post('/esewa/verify', verifyEsewaPayment);

/**
 * @route   GET /api/payments/esewa/status/:bookingId
 * @desc    Check payment status with eSewa API
 * @access  Private
 */
router.get('/esewa/status/:bookingId', checkPaymentStatus);

/**
 * @route   POST /api/payments/esewa/failure
 * @desc    Handle payment failure callback
 * @access  Private
 */
router.post('/esewa/failure', handlePaymentFailure);

// ============================================
// KHALTI ROUTES
// ============================================

/**
 * @route   POST /api/payments/khalti/initiate
 * @desc    Initiate Khalti payment for a booking
 * @access  Private
 */
router.post('/khalti/initiate', initiateKhaltiPaymentController);

/**
 * @route   POST /api/payments/khalti/verify
 * @desc    Verify Khalti payment after redirect
 * @access  Private
 */
router.post('/khalti/verify', verifyKhaltiPaymentController);

/**
 * @route   GET /api/payments/khalti/status/:bookingId
 * @desc    Check payment status with Khalti API
 * @access  Private
 */
router.get('/khalti/status/:bookingId', checkKhaltiPaymentStatus);

// ============================================
// COMMON ROUTES
// ============================================

/**
 * @route   GET /api/payments/:bookingId
 * @desc    Get payment details for a booking
 * @access  Private
 */
router.get('/:bookingId', getPaymentDetails);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createStripeCheckoutSession, verifyStripePayment } = require('../controllers/paymentController');
const { recaptchaMiddleware } = require('../middleware/recaptchaMiddleware');

// Stripe Routes
router.post('/create-checkout-session', protect, recaptchaMiddleware.booking, createStripeCheckoutSession);
router.post('/verify-payment', protect, verifyStripePayment);

module.exports = router;

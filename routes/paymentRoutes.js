const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createStripeCheckoutSession, verifyStripePayment } = require('../controllers/paymentController');

// Stripe Routes
router.post('/create-checkout-session', protect, createStripeCheckoutSession);
router.post('/verify-payment', protect, verifyStripePayment);

module.exports = router;

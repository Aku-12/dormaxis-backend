const Booking = require('../models/Booking');
const Dorm = require('../models/Dorm');
// Use process.env directly or a config file. Using config for consistency if updated.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Create Stripe Checkout Session
 * Creates a pending booking and a Stripe session for payment.
 */
const createStripeCheckoutSession = async (req, res) => {
  try {
    const { dormId, checkIn, checkOut, guests, totalAmount, discount, promoCode, firstName, lastName, email, phone } = req.body;
    const userId = req.user._id;

    console.log('[Stripe Initiate] Request:', { userId, dormId, totalAmount, email });

    // Validate Dorm
    const dorm = await Dorm.findById(dormId);
    if (!dorm) {
      return res.status(404).json({ success: false, error: 'Dorm not found' });
    }

    // Create Pending Booking First
    const booking = await Booking.create({
      user: userId,
      dorm: dormId,
      firstName,
      lastName,
      email,
      phone,
      checkIn,
      checkOut,
      numberOfOccupants: guests,
      monthlyRent: dorm.price, // Assuming dorm.price is monthly rent, verify if needed
      securityDeposit: dorm.securityDeposit || 0, // Fallback if needed
      totalAmount,
      discount: discount || 0,
      promoCode: promoCode || null,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'stripe',
      paymentInitiatedAt: new Date(),
      termsAccepted: true
    });

    console.log('[Stripe Initiate] Booking Created:', booking._id);

    // Create Stripe Session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log('[Stripe Initiate] Using FRONTEND_URL:', frontendUrl);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'npr', // Or 'usd' if required, assuming NPR for Nepal context
            product_data: {
              name: `Booking for ${dorm.name}`,
              description: `Block ${dorm.block} - ${guests} Guests`,
              images: dorm.image ? [dorm.image] : [], // Ensure image URL is valid
            },
            unit_amount: Math.round(totalAmount * 100), // Stripe expects amounts in cents/paisa
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/booking/success/${booking._id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/booking/${dormId}`,
      metadata: {
        bookingId: booking._id.toString(),
        userId: userId.toString(),
      },
    });

    // Save session ID to booking
    booking.stripeSessionId = session.id;
    await booking.save();

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Stripe Initiate Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
};

/**
 * Verify Stripe Payment
 * Verifies the session status after redirect
 */
const verifyStripePayment = async (req, res) => {
  try {
    const { sessionId, bookingId } = req.body;

    if (!sessionId || !bookingId) {
      return res.status(400).json({ success: false, error: 'Missing session ID or booking ID' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Verify session status
    if (session.payment_status === 'paid') {
      // Update Booking
      if (booking.paymentStatus !== 'paid') {
          booking.status = 'confirmed';
          booking.paymentStatus = 'paid';
          booking.paidAt = new Date();
          await booking.save();
      }
      
      await booking.populate('dorm');
      await booking.populate('user', 'name email');

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: { booking }
      });
    } else {
      return res.status(400).json({ success: false, error: 'Payment not completed' });
    }

  } catch (error) {
    console.error('Stripe Verify Error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
};

module.exports = {
  createStripeCheckoutSession,
  verifyStripePayment
};

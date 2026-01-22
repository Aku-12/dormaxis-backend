const Booking = require('../models/Booking');
const axios = require('axios');
const {
  generatePaymentSignature,
  verifyResponseSignature,
  decodeEsewaResponse,
  generateTransactionUUID,
  buildPaymentFormData,
  getPaymentUrl,
  getStatusCheckUrl
} = require('../utils/esewaUtils');
const {
  initiateKhaltiPayment,
  verifyKhaltiPayment,
  parseKhaltiCallback,
  isPaymentSuccessful,
  isPaymentFailed,
  isPaymentPending
} = require('../utils/khaltiUtils');

/**
 * Initiate eSewa payment
 * POST /api/payments/esewa/initiate
 */
const initiateEsewaPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // Find the booking
    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user.id,
      paymentStatus: 'pending'
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or already paid'
      });
    }

    // Generate unique transaction UUID
    const transactionUuid = generateTransactionUUID(bookingId);

    // Update booking with transaction UUID
    booking.transactionUuid = transactionUuid;
    booking.paymentInitiatedAt = new Date();
    await booking.save();

    // Build payment form data
    const formData = buildPaymentFormData({
      amount: booking.totalAmount,
      taxAmount: 0,
      serviceCharge: 0,
      deliveryCharge: 0,
      transactionUuid,
      bookingId
    });

    res.json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentUrl: getPaymentUrl(),
        formData,
        bookingId: booking._id
      }
    });
  } catch (error) {
    console.error('Error initiating eSewa payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate payment'
    });
  }
};

/**
 * Verify eSewa payment callback
 * POST /api/payments/esewa/verify
 */
const verifyEsewaPayment = async (req, res) => {
  try {
    const { data, bookingId } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Payment data is required'
      });
    }

    // Decode the Base64 response from eSewa
    let paymentResponse;
    try {
      paymentResponse = decodeEsewaResponse(data);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment response format'
      });
    }

    const { 
      transaction_code, 
      status, 
      total_amount, 
      transaction_uuid, 
      product_code,
      signed_field_names,
      signature 
    } = paymentResponse;

    // Find the booking by transaction UUID
    const booking = await Booking.findOne({
      transactionUuid: transaction_uuid,
      paymentStatus: 'pending'
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or already processed'
      });
    }

    // Verify signature
    const isValidSignature = verifyResponseSignature(paymentResponse);
    
    if (!isValidSignature) {
      console.error('Invalid eSewa signature for transaction:', transaction_uuid);
      
      // Mark as failed due to signature mismatch
      booking.paymentStatus = 'failed';
      booking.paymentError = 'Signature verification failed';
      await booking.save();

      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - invalid signature'
      });
    }

    // Verify amount matches
    const expectedAmount = booking.totalAmount;
    if (parseFloat(total_amount) !== expectedAmount) {
      console.error('Amount mismatch:', { expected: expectedAmount, received: total_amount });
      
      booking.paymentStatus = 'failed';
      booking.paymentError = 'Amount mismatch';
      await booking.save();

      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - amount mismatch'
      });
    }

    // Update booking based on payment status
    if (status === 'COMPLETE') {
      booking.paymentStatus = 'paid';
      booking.paymentReference = transaction_code;
      booking.status = 'confirmed';
      booking.paidAt = new Date();
      await booking.save();

      // Populate dorm details for response
      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          booking,
          transactionCode: transaction_code,
          status: 'COMPLETE'
        }
      });
    } else {
      booking.paymentStatus = 'failed';
      booking.paymentError = `Payment status: ${status}`;
      await booking.save();

      return res.status(400).json({
        success: false,
        error: `Payment not completed. Status: ${status}`
      });
    }
  } catch (error) {
    console.error('Error verifying eSewa payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

/**
 * Check eSewa payment status
 * GET /api/payments/esewa/status/:bookingId
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find the booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // If already paid, return success
    if (booking.paymentStatus === 'paid') {
      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');
      return res.json({
        success: true,
        data: {
          status: 'COMPLETE',
          booking
        }
      });
    }

    // If no transaction UUID, payment was never initiated
    if (!booking.transactionUuid) {
      return res.json({
        success: true,
        data: {
          status: 'NOT_INITIATED',
          booking
        }
      });
    }

    // Query eSewa for payment status
    const statusUrl = getStatusCheckUrl();
    const productCode = process.env.ESEWA_MERCHANT_CODE;
    
    try {
      const response = await axios.get(statusUrl, {
        params: {
          product_code: productCode,
          total_amount: booking.totalAmount,
          transaction_uuid: booking.transactionUuid
        }
      });

      const { status, ref_id } = response.data;

      // Update booking based on status
      if (status === 'COMPLETE') {
        booking.paymentStatus = 'paid';
        booking.paymentReference = ref_id;
        booking.status = 'confirmed';
        booking.paidAt = new Date();
        await booking.save();
      } else if (status === 'PENDING') {
        // Payment is still pending, no update needed
      } else if (['FULL_REFUND', 'PARTIAL_REFUND'].includes(status)) {
        booking.paymentStatus = 'refunded';
        await booking.save();
      } else if (['NOT_FOUND', 'CANCELED'].includes(status)) {
        booking.paymentStatus = 'failed';
        booking.paymentError = `Payment ${status}`;
        await booking.save();
      }

      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');

      return res.json({
        success: true,
        data: {
          status,
          refId: ref_id,
          booking
        }
      });
    } catch (apiError) {
      console.error('Error calling eSewa status API:', apiError.message);
      
      // Return current booking status if API call fails
      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');
      return res.json({
        success: true,
        data: {
          status: booking.paymentStatus === 'paid' ? 'COMPLETE' : 'UNKNOWN',
          booking,
          warning: 'Could not verify with eSewa. Showing last known status.'
        }
      });
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
};

/**
 * Handle eSewa payment failure callback
 * POST /api/payments/esewa/failure
 */
const handlePaymentFailure = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);

    if (booking && booking.paymentStatus === 'pending') {
      booking.paymentStatus = 'failed';
      booking.paymentError = 'Payment cancelled or failed by user';
      await booking.save();
    }

    res.json({
      success: true,
      message: 'Payment failure recorded',
      data: { bookingId }
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment failure'
    });
  }
};

/**
 * Get payment details for a booking
 * GET /api/payments/:bookingId
 */
const getPaymentDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user.id
    }).populate('dorm', 'name image beds block amenities rating totalReviews price');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: {
        booking,
        paymentUrl: getPaymentUrl(),
        canRetry: booking.paymentStatus === 'failed' || booking.paymentStatus === 'pending'
      }
    });
  } catch (error) {
    console.error('Error getting payment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment details'
    });
  }
};

// ============================================
// KHALTI PAYMENT CONTROLLERS
// ============================================

/**
 * Initiate Khalti payment
 * POST /api/payments/khalti/initiate
 */
const initiateKhaltiPaymentController = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // Find the booking
    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user.id,
      paymentStatus: 'pending'
    }).populate('dorm', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or already paid'
      });
    }

    // Prepare customer info
    const customerInfo = {
      name: `${booking.firstName} ${booking.lastName}`,
      email: booking.email,
      phone: booking.phone.replace(/[^0-9]/g, '').slice(-10) // Get last 10 digits
    };

    // Initiate Khalti payment
    const result = await initiateKhaltiPayment({
      amount: booking.totalAmount,
      bookingId: bookingId,
      purchaseOrderName: `Dorm Booking - ${booking.dorm?.name || 'DormAxis'}`,
      customerInfo
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error?.message || 'Failed to initiate Khalti payment'
      });
    }

    // Update booking with Khalti payment ID
    booking.khaltiPidx = result.data.pidx;
    booking.khaltiPurchaseOrderId = result.data.purchaseOrderId;
    booking.paymentInitiatedAt = new Date();
    await booking.save();

    res.json({
      success: true,
      message: 'Khalti payment initiated successfully',
      data: {
        pidx: result.data.pidx,
        paymentUrl: result.data.paymentUrl,
        expiresAt: result.data.expiresAt,
        expiresIn: result.data.expiresIn,
        bookingId: booking._id
      }
    });
  } catch (error) {
    console.error('Error initiating Khalti payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Khalti payment'
    });
  }
};

/**
 * Verify Khalti payment callback
 * POST /api/payments/khalti/verify
 */
const verifyKhaltiPaymentController = async (req, res) => {
  try {
    const { pidx, bookingId, status, transaction_id } = req.body;

    if (!pidx || !bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID and booking ID are required'
      });
    }

    // Find the booking
    const booking = await Booking.findOne({
      _id: bookingId,
      khaltiPidx: pidx
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // If already paid, return success
    if (booking.paymentStatus === 'paid') {
      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          booking,
          status: 'Completed'
        }
      });
    }

    // Verify with Khalti lookup API
    const lookupResult = await verifyKhaltiPayment(pidx);

    if (!lookupResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to verify payment with Khalti'
      });
    }

    const paymentData = lookupResult.data;

    // Verify amount (convert from paisa to rupees)
    const paidAmount = paymentData.total_amount / 100;
    if (paidAmount !== booking.totalAmount) {
      console.error('Amount mismatch:', { expected: booking.totalAmount, received: paidAmount });
      
      booking.paymentStatus = 'failed';
      booking.paymentError = 'Amount mismatch';
      await booking.save();

      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - amount mismatch'
      });
    }

    // Update booking based on payment status
    if (isPaymentSuccessful(paymentData.status)) {
      booking.paymentStatus = 'paid';
      booking.paymentReference = paymentData.transaction_id;
      booking.status = 'confirmed';
      booking.paidAt = new Date();
      await booking.save();

      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          booking,
          transactionId: paymentData.transaction_id,
          status: paymentData.status
        }
      });
    } else if (isPaymentFailed(paymentData.status)) {
      booking.paymentStatus = 'failed';
      booking.paymentError = `Payment ${paymentData.status}`;
      await booking.save();

      return res.status(400).json({
        success: false,
        error: `Payment failed: ${paymentData.status}`
      });
    } else if (isPaymentPending(paymentData.status)) {
      return res.json({
        success: true,
        message: 'Payment is pending',
        data: {
          status: paymentData.status,
          booking
        }
      });
    } else if (paymentData.refunded) {
      booking.paymentStatus = 'refunded';
      await booking.save();

      return res.status(400).json({
        success: false,
        error: 'Payment has been refunded'
      });
    }

    // Unknown status
    return res.status(400).json({
      success: false,
      error: `Unknown payment status: ${paymentData.status}`
    });
  } catch (error) {
    console.error('Error verifying Khalti payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

/**
 * Check Khalti payment status
 * GET /api/payments/khalti/status/:bookingId
 */
const checkKhaltiPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // If already paid, return success
    if (booking.paymentStatus === 'paid') {
      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');
      return res.json({
        success: true,
        data: {
          status: 'Completed',
          booking
        }
      });
    }

    // If no Khalti pidx, payment was never initiated
    if (!booking.khaltiPidx) {
      return res.json({
        success: true,
        data: {
          status: 'NOT_INITIATED',
          booking
        }
      });
    }

    // Query Khalti for payment status
    const lookupResult = await verifyKhaltiPayment(booking.khaltiPidx);

    if (!lookupResult.success) {
      await booking.populate('dorm', 'name image beds block amenities rating totalReviews');
      return res.json({
        success: true,
        data: {
          status: booking.paymentStatus === 'paid' ? 'Completed' : 'UNKNOWN',
          booking,
          warning: 'Could not verify with Khalti. Showing last known status.'
        }
      });
    }

    const paymentData = lookupResult.data;

    // Update booking based on status
    if (isPaymentSuccessful(paymentData.status)) {
      booking.paymentStatus = 'paid';
      booking.paymentReference = paymentData.transaction_id;
      booking.status = 'confirmed';
      booking.paidAt = new Date();
      await booking.save();
    } else if (isPaymentFailed(paymentData.status)) {
      booking.paymentStatus = 'failed';
      booking.paymentError = `Payment ${paymentData.status}`;
      await booking.save();
    } else if (paymentData.refunded) {
      booking.paymentStatus = 'refunded';
      await booking.save();
    }

    await booking.populate('dorm', 'name image beds block amenities rating totalReviews');

    return res.json({
      success: true,
      data: {
        status: paymentData.status,
        transactionId: paymentData.transaction_id,
        booking
      }
    });
  } catch (error) {
    console.error('Error checking Khalti payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
};

module.exports = {
  initiateEsewaPayment,
  verifyEsewaPayment,
  checkPaymentStatus,
  handlePaymentFailure,
  getPaymentDetails,
  // Khalti exports
  initiateKhaltiPaymentController,
  verifyKhaltiPaymentController,
  checkKhaltiPaymentStatus
};

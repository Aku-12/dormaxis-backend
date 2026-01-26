const Booking = require('../models/Booking');
const Dorm = require('../models/Dorm');
const PromoCode = require('../models/PromoCode');
const { createNotification } = require('./notificationController');
const { createAuditLog } = require('../utils/auditLogger');

// Security deposit percentage of monthly rent
const SECURITY_DEPOSIT_PERCENTAGE = 17.14; // Approximately Rs 1200 for Rs 7000 rent

// Create a new booking
const createBooking = async (req, res) => {
  try {
    const {
      dormId,
      firstName,
      lastName,
      email,
      phone,
      numberOfOccupants,
      paymentMethod,
      termsAccepted,
      promoCode
    } = req.body;

    // Check if dorm exists and is available
    const dorm = await Dorm.findById(dormId);
    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    if (!dorm.isAvailable) {
      return res.status(400).json({
        success: false,
        error: 'This dorm is not available for booking'
      });
    }

    // Calculate pricing
    const monthlyRent = dorm.price;
    const securityDeposit = Math.round(monthlyRent * SECURITY_DEPOSIT_PERCENTAGE / 100);
    let discount = 0;
    let appliedPromoCode = null;

    // Apply promo code if provided
    if (promoCode) {
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase() });
      if (promo) {
        const totalBeforeDiscount = monthlyRent + securityDeposit;
        const validationResult = promo.isValid(totalBeforeDiscount);
        
        if (validationResult.valid) {
          discount = promo.calculateDiscount(totalBeforeDiscount);
          appliedPromoCode = promo.code;
          
          // Increment usage count
          promo.usedCount += 1;
          await promo.save();
        }
      }
    }

    const totalAmount = monthlyRent + securityDeposit - discount;

    // Create booking
    const booking = new Booking({
      user: req.user.id,
      dorm: dormId,
      firstName,
      lastName,
      email,
      phone,
      numberOfOccupants,
      paymentMethod,
      monthlyRent,
      securityDeposit,
      promoCode: appliedPromoCode,
      discount,
      totalAmount,
      termsAccepted,
      status: 'pending',
      paymentStatus: 'pending'
    });

    await booking.save();

    // Create audit log for booking creation
    await createAuditLog({
      action: 'CREATE',
      targetType: 'Booking',
      targetId: booking._id,
      targetName: `Booking for ${dorm.name}`,
      after: booking.toObject(),
      req
    });

    // Create notification for booking
    await createNotification(
      req.user.id,
      'booking',
      'Booking Created',
      `Your booking for ${dorm.name} has been created. Please complete the payment to confirm.`,
      `/booking/payment/${booking._id}`,
      { bookingId: booking._id, dormId: dormId }
    );

    // Populate dorm details for response
    await booking.populate('dorm', 'name image beds block amenities rating totalReviews');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
};

// Get user's bookings
const getUserBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { user: req.user.id };
    
    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate('dorm', 'name image beds block amenities rating totalReviews price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      count: bookings.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
};

// Get single booking by ID
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
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
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking'
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed booking'
      });
    }

    // Store state before cancellation
    const bookingBefore = booking.toObject();

    booking.status = 'cancelled';
    await booking.save();

    // Create audit log for booking cancellation
    await createAuditLog({
      action: 'UPDATE',
      targetType: 'Booking',
      targetId: booking._id,
      targetName: `Booking #${booking._id.toString().slice(-6).toUpperCase()}`,
      before: { status: bookingBefore.status },
      after: { status: 'cancelled' },
      req
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
};

// Validate promo code
const validatePromoCode = async (req, res) => {
  try {
    const { code, amount } = req.body;

    const promo = await PromoCode.findOne({ code: code.toUpperCase() });

    if (!promo) {
      return res.status(404).json({
        success: false,
        error: 'Invalid promo code'
      });
    }

    const validationResult = promo.isValid(Number(amount));

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: validationResult.message
      });
    }

    const discount = promo.calculateDiscount(Number(amount));

    res.json({
      success: true,
      data: {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discount,
        description: promo.description
      }
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate promo code'
    });
  }
};

// Get booking price preview (without creating booking)
const getBookingPreview = async (req, res) => {
  try {
    const { dormId, promoCode } = req.query;

    const dorm = await Dorm.findById(dormId);
    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    const monthlyRent = dorm.price;
    const securityDeposit = Math.round(monthlyRent * SECURITY_DEPOSIT_PERCENTAGE / 100);
    let discount = 0;
    let promoDetails = null;

    if (promoCode) {
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase() });
      if (promo) {
        const totalBeforeDiscount = monthlyRent + securityDeposit;
        const validationResult = promo.isValid(totalBeforeDiscount);
        
        if (validationResult.valid) {
          discount = promo.calculateDiscount(totalBeforeDiscount);
          promoDetails = {
            code: promo.code,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            discount
          };
        }
      }
    }

    const totalAmount = monthlyRent + securityDeposit - discount;

    res.json({
      success: true,
      data: {
        dorm: {
          id: dorm._id,
          name: dorm.name,
          image: dorm.image,
          beds: dorm.beds,
          block: dorm.block,
          amenities: dorm.amenities,
          rating: dorm.rating,
          totalReviews: dorm.totalReviews
        },
        pricing: {
          monthlyRent,
          securityDeposit,
          discount,
          totalAmount,
          promoDetails
        }
      }
    });
  } catch (error) {
    console.error('Error getting booking preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get booking preview'
    });
  }
};

// Admin: Get all bookings
const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = {};
    
    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate('user', 'name email')
      .populate('dorm', 'name image beds block price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      count: bookings.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
};

// Admin: Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Store booking state before update for audit logging
    const bookingBefore = booking.toObject();

    booking.status = status;

    // Update payment status if confirmed
    if (status === 'confirmed') {
      booking.paymentStatus = 'paid';
    }

    await booking.save();

    await booking.populate('user', 'name email');
    await booking.populate('dorm', 'name image beds block price');

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      targetType: 'Booking',
      targetId: booking._id,
      targetName: `Booking #${booking._id.toString().slice(-6).toUpperCase()}`,
      before: bookingBefore,
      after: booking.toObject(),
      req
    });

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking status'
    });
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  validatePromoCode,
  getBookingPreview,
  getAllBookings,
  updateBookingStatus
};

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm',
    required: true
  },
  // Person Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  numberOfOccupants: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
    default: 1
  },
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['esewa', 'khalti', 'bank_transfer', 'cash'],
    default: 'esewa'
  },
  // Pricing
  monthlyRent: {
    type: Number,
    required: true
  },
  securityDeposit: {
    type: Number,
    required: true
  },
  promoCode: {
    type: String,
    default: null
  },
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  // Booking Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  // Terms Agreement
  termsAccepted: {
    type: Boolean,
    required: true,
    default: false
  },
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentReference: {
    type: String,
    default: null
  },
  // eSewa Transaction Details
  transactionUuid: {
    type: String,
    default: null,
    index: true
  },
  paymentInitiatedAt: {
    type: Date,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  paymentError: {
    type: String,
    default: null
  },
  // Khalti Transaction Details
  khaltiPidx: {
    type: String,
    default: null,
    index: true
  },
  khaltiPurchaseOrderId: {
    type: String,
    default: null
  },
  // Check-in Information
  checkInDate: {
    type: Date,
    default: null
  },
  // Notes
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for faster queries
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ dorm: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

// Virtual for booking reference number
bookingSchema.virtual('bookingRef').get(function() {
  return `DRM-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Ensure virtuals are included when converting to JSON
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Booking', bookingSchema);

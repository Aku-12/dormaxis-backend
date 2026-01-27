const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number,
    default: null // Maximum discount amount for percentage discounts
  },
  minBookingAmount: {
    type: Number,
    default: 0
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster lookups
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validUntil: 1 });

// Method to check if promo code is valid
promoCodeSchema.methods.isValid = function(bookingAmount) {
  const now = new Date();
  
  if (!this.isActive) {
    return { valid: false, message: 'This promo code is no longer active' };
  }
  
  if (now < this.validFrom) {
    return { valid: false, message: 'This promo code is not yet valid' };
  }
  
  if (now > this.validUntil) {
    return { valid: false, message: 'This promo code has expired' };
  }
  
  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return { valid: false, message: 'This promo code has reached its usage limit' };
  }
  
  if (bookingAmount < this.minBookingAmount) {
    return { valid: false, message: `Minimum booking amount of Rs ${this.minBookingAmount} required` };
  }
  
  return { valid: true };
};

// Method to calculate discount
promoCodeSchema.methods.calculateDiscount = function(amount) {
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (amount * this.discountValue) / 100;
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else {
    discount = this.discountValue;
  }
  
  return Math.min(discount, amount); // Discount can't exceed amount
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);

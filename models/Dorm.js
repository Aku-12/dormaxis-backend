const mongoose = require('mongoose');

const dormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  beds: {
    type: Number,
    required: true
  },
  block: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['single', 'two-seater', 'three-seater', 'four-seater', 'shared', 'premium'],
    default: 'single'
  },
  image: {
    type: String,
    default: ''
  },
  images: [{
    type: String
  }],
  amenities: [{
    type: String,
    enum: [
      'WiFi', 
      'Air Conditioning', 
      'Parking', 
      'Laundry', 
      'Furnished', 
      'Kitchen', 
      'TV', 
      'Gym',
      'Study Table',
      'Attached Bathroom',
      'Hot Water',
      'Balcony',
      'Security',
      'CCTV',
      'Wardrobe',
      'Power Backup'
    ]
  }],
  // Badge flags
  isPopular: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for faster filtering
dormSchema.index({ block: 1 });
dormSchema.index({ type: 1 });
dormSchema.index({ price: 1 });
dormSchema.index({ beds: 1 });
dormSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('Dorm', dormSchema);

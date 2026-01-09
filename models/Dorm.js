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
  image: {
    type: String,
    default: ''
  },
  amenities: [{
    type: String
  }],
  isPopular: {
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Dorm', dormSchema);

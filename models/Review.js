const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Cached user data for display (avoids extra lookups)
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes for faster queries
reviewSchema.index({ dorm: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });

// Prevent duplicate reviews from same user for same dorm
reviewSchema.index({ dorm: 1, user: 1 }, { unique: true });

// Static method to calculate average rating for a dorm
reviewSchema.statics.calculateAverageRating = async function(dormId) {
  const result = await this.aggregate([
    { $match: { dorm: dormId } },
    { 
      $group: { 
        _id: '$dorm', 
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      } 
    }
  ]);

  if (result.length > 0) {
    await mongoose.model('Dorm').findByIdAndUpdate(dormId, {
      rating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews
    });
  } else {
    await mongoose.model('Dorm').findByIdAndUpdate(dormId, {
      rating: 0,
      totalReviews: 0
    });
  }
};

// Update dorm rating after save
reviewSchema.post('save', async function() {
  await this.constructor.calculateAverageRating(this.dorm);
});

// Update dorm rating after remove
reviewSchema.post('remove', async function() {
  await this.constructor.calculateAverageRating(this.dorm);
});

module.exports = mongoose.model('Review', reviewSchema);

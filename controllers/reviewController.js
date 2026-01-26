const Review = require('../models/Review');
const Dorm = require('../models/Dorm');

// Get reviews for a dorm with pagination
const getReviewsByDormId = async (req, res) => {
  try {
    const { dormId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if dorm exists
    const dorm = await Dorm.findById(dormId);
    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Review.countDocuments({ dorm: dormId });

    const reviews = await Review.find({ dorm: dormId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-__v');

    // Calculate rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { dorm: dorm._id } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingDistribution.forEach(r => {
      distribution[r._id] = r.count;
    });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit))
      },
      stats: {
        averageRating: dorm.rating,
        totalReviews: dorm.totalReviews,
        distribution
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    });
  }
};

// Add a review
const addReview = async (req, res) => {
  try {
    const { dormId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Rating and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Check if dorm exists
    const dorm = await Dorm.findById(dormId);
    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    // Check if user already reviewed this dorm
    const existingReview = await Review.findOne({ dorm: dormId, user: userId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this dorm'
      });
    }

    // Create review with cached user data
    const review = await Review.create({
      dorm: dormId,
      user: userId,
      userName: req.user.name,
      userAvatar: req.user.avatar || '',
      rating: Number(rating),
      comment: comment.trim()
    });

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error adding review:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this dorm'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to add review'
    });
  }
};

// Delete a review (by review owner or admin)
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Check ownership or admin status
    if (!isAdmin && review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this review'
      });
    }

    const dormId = review.dorm;
    await review.deleteOne();

    // Recalculate average rating
    await Review.calculateAverageRating(dormId);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete review'
    });
  }
};

module.exports = {
  getReviewsByDormId,
  addReview,
  deleteReview
};

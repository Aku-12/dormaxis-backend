const express = require('express');
const router = express.Router();
const {
  getReviewsByDormId,
  addReview,
  deleteReview
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/reviews/:dormId - Get reviews for a dorm
router.get('/:dormId', getReviewsByDormId);

// POST /api/reviews/:dormId - Add a review (protected)
router.post('/:dormId', protect, addReview);

// DELETE /api/reviews/review/:reviewId - Delete a review (protected)
router.delete('/review/:reviewId', protect, deleteReview);

module.exports = router;

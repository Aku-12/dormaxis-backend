const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist
} = require('../controllers/wishlistController');

// All wishlist routes require authentication
router.use(protect);

// GET /api/wishlist - Get user's wishlist
router.get('/', getWishlist);

// GET /api/wishlist/check/:dormId - Check if dorm is in wishlist
router.get('/check/:dormId', checkWishlist);

// POST /api/wishlist/:dormId - Add to wishlist
router.post('/:dormId', addToWishlist);

// DELETE /api/wishlist/:dormId - Remove from wishlist
router.delete('/:dormId', removeFromWishlist);

module.exports = router;

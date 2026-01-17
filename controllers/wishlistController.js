const User = require('../models/User');
const Dorm = require('../models/Dorm');

/**
 * Get user's wishlist
 * GET /api/wishlist
 */
const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'wishlist',
        select: 'name price beds block type image amenities isPopular isFeatured isVerified isNew rating'
      });

    res.json({
      success: true,
      count: user.wishlist.length,
      data: user.wishlist
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wishlist'
    });
  }
};

/**
 * Add dorm to wishlist
 * POST /api/wishlist/:dormId
 */
const addToWishlist = async (req, res) => {
  try {
    const { dormId } = req.params;

    // Check if dorm exists
    const dorm = await Dorm.findById(dormId);
    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    // Check if already in wishlist
    const user = await User.findById(req.user._id);
    if (user.wishlist.includes(dormId)) {
      return res.status(400).json({
        success: false,
        error: 'Dorm already in wishlist'
      });
    }

    // Add to wishlist
    user.wishlist.push(dormId);
    await user.save();

    res.json({
      success: true,
      message: 'Added to wishlist successfully'
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to wishlist'
    });
  }
};

/**
 * Remove dorm from wishlist
 * DELETE /api/wishlist/:dormId
 */
const removeFromWishlist = async (req, res) => {
  try {
    const { dormId } = req.params;

    const user = await User.findById(req.user._id);
    
    // Check if in wishlist
    if (!user.wishlist.includes(dormId)) {
      return res.status(400).json({
        success: false,
        error: 'Dorm not in wishlist'
      });
    }

    // Remove from wishlist
    user.wishlist = user.wishlist.filter(id => id.toString() !== dormId);
    await user.save();

    res.json({
      success: true,
      message: 'Removed from wishlist successfully'
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from wishlist'
    });
  }
};

/**
 * Check if dorm is in wishlist
 * GET /api/wishlist/check/:dormId
 */
const checkWishlist = async (req, res) => {
  try {
    const { dormId } = req.params;
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      isInWishlist: user.wishlist.includes(dormId)
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check wishlist'
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist
};

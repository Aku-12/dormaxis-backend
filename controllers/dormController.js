const Dorm = require('../models/Dorm');

// Get all dorms with filters, sorting, and pagination
const getAllDorms = async (req, res) => {
  try {
    const { 
      search, 
      minPrice, 
      maxPrice, 
      beds, 
      block, 
      type,
      amenities,
      sort = 'recommended',
      page = 1,
      limit = 12
    } = req.query;

    let query = { isAvailable: true };

    // Build query based on filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (beds && beds !== 'any') {
      query.beds = Number(beds);
    }

    if (block && block !== 'all') {
      query.block = block;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    // Filter by amenities (must have ALL selected amenities)
    if (amenities) {
      const amenityList = Array.isArray(amenities) ? amenities : amenities.split(',');
      if (amenityList.length > 0) {
        query.amenities = { $all: amenityList };
      }
    }

    // Build sort options
    let sortOption = {};
    switch (sort) {
      case 'price-low':
        sortOption = { price: 1 };
        break;
      case 'price-high':
        sortOption = { price: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'rating':
        sortOption = { rating: -1 };
        break;
      case 'recommended':
      default:
        // Recommended: Featured first, then popular, then by rating
        sortOption = { isFeatured: -1, isPopular: -1, rating: -1 };
        break;
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Dorm.countDocuments(query);

    const dorms = await Dorm.find(query)
      .select('-__v')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      count: dorms.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: dorms
    });
  } catch (error) {
    console.error('Error fetching dorms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dorms'
    });
  }
};

// Get available filter options (for dropdowns)
const getFilterOptions = async (req, res) => {
  try {
    const blocks = await Dorm.distinct('block', { isAvailable: true });
    const types = await Dorm.distinct('type', { isAvailable: true });
    const bedsOptions = await Dorm.distinct('beds', { isAvailable: true });
    const priceRange = await Dorm.aggregate([
      { $match: { isAvailable: true } },
      { 
        $group: { 
          _id: null, 
          minPrice: { $min: '$price' }, 
          maxPrice: { $max: '$price' } 
        } 
      }
    ]);

    res.json({
      success: true,
      data: {
        blocks: blocks.sort(),
        types,
        beds: bedsOptions.sort((a, b) => a - b),
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 50000 },
        amenities: ['WiFi', 'Air Conditioning', 'Parking', 'Laundry', 'Furnished', 'Kitchen', 'TV', 'Gym']
      }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options'
    });
  }
};

// Get single dorm by ID
const getDormById = async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id).select('-__v');

    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      data: dorm
    });
  } catch (error) {
    console.error('Error fetching dorm:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dorm'
    });
  }
};

// Create new dorm
const createDorm = async (req, res) => {
  try {
    const dorm = await Dorm.create(req.body);

    res.status(201).json({
      success: true,
      data: dorm
    });
  } catch (error) {
    console.error('Error creating dorm:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create dorm'
    });
  }
};

// Update dorm
const updateDorm = async (req, res) => {
  try {
    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      data: dorm
    });
  } catch (error) {
    console.error('Error updating dorm:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update dorm'
    });
  }
};

// Delete dorm
const deleteDorm = async (req, res) => {
  try {
    const dorm = await Dorm.findByIdAndDelete(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        error: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      message: 'Dorm deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dorm:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dorm'
    });
  }
};

module.exports = {
  getAllDorms,
  getFilterOptions,
  getDormById,
  createDorm,
  updateDorm,
  deleteDorm
};

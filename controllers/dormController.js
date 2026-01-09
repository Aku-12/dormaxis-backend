const Dorm = require('../models/Dorm');

// Get all dorms
const getAllDorms = async (req, res) => {
  try {
    const { search, minPrice, maxPrice, beds, block } = req.query;

    let query = {};

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

    if (beds) {
      query.beds = Number(beds);
    }

    if (block) {
      query.block = block;
    }

    const dorms = await Dorm.find(query).select('-__v').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: dorms.length,
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
  getDormById,
  createDorm,
  updateDorm,
  deleteDorm
};

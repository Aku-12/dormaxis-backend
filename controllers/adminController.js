const Dorm = require('../models/Dorm');
const User = require('../models/User');

// ========== DORM MANAGEMENT ==========

// Get all dorms (admin view with pagination)
exports.getAllDorms = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const dorms = await Dorm.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Dorm.countDocuments();

    res.json({
      success: true,
      data: {
        dorms,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dorms',
      error: error.message
    });
  }
};

// Get single dorm by ID
exports.getDormById = async (req, res) => {
  try {
    const dorm = await Dorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      data: dorm
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dorm',
      error: error.message
    });
  }
};

// Create new dorm
exports.createDorm = async (req, res) => {
  try {
    const { name, description, price, beds, block, amenities, isPopular, rating, image, imageUrl } = req.body;

    const dorm = new Dorm({
      name,
      description,
      price,
      beds,
      block,
      amenities: amenities || [],
      isPopular: isPopular || false,
      rating: rating || 0,
      image: image || imageUrl || ''
    });

    await dorm.save();

    res.status(201).json({
      success: true,
      message: 'Dorm created successfully',
      data: dorm
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating dorm',
      error: error.message
    });
  }
};

// Update dorm
exports.updateDorm = async (req, res) => {
  try {
    const { name, description, price, beds, block, amenities, isPopular, rating, image, imageUrl } = req.body;

    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        beds,
        block,
        amenities,
        isPopular,
        rating,
        image: image || imageUrl || ''
      },
      { new: true, runValidators: true }
    );

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      message: 'Dorm updated successfully',
      data: dorm
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating dorm',
      error: error.message
    });
  }
};

// Delete dorm
exports.deleteDorm = async (req, res) => {
  try {
    const dorm = await Dorm.findByIdAndDelete(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    res.json({
      success: true,
      message: 'Dorm deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting dorm',
      error: error.message
    });
  }
};

// ========== USER MANAGEMENT ==========

// Get all users (admin view with pagination)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, phone, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, phone, isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalDorms = await Dorm.countDocuments();
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const popularDorms = await Dorm.countDocuments({ isPopular: true });

    res.json({
      success: true,
      data: {
        totalDorms,
        totalUsers,
        activeUsers,
        popularDorms
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

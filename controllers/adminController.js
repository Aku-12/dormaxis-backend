const Dorm = require('../models/Dorm');
const User = require('../models/User');
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');
const { createAuditLog } = require('../utils/auditLogger');

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
    const { name, description, price, beds, block, amenities, isPopular, rating, image, images } = req.body;

    const dorm = new Dorm({
      name,
      description,
      price,
      beds,
      block,
      amenities: amenities || [],
      isPopular: isPopular || false,
      rating: rating || 0,
      image: image || (images && images.length > 0 ? images[0] : ''),
      images: images || (image ? [image] : [])
    });

    await dorm.save();

    // Create audit log
    await createAuditLog({
      action: 'CREATE',
      targetType: 'Dorm',
      targetId: dorm._id,
      targetName: dorm.name,
      after: dorm,
      req
    });

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

// Upload dorm images (multiple) - uploads to Cloudinary
exports.uploadDormImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }

    // Upload all files to Cloudinary
    const uploadPromises = req.files.map(file =>
      uploadToCloudinary(file.buffer, 'dorms')
    );

    const results = await Promise.all(uploadPromises);

    // Extract secure URLs from Cloudinary response
    const imagePaths = results.map(result => result.secure_url);

    res.json({
      success: true,
      message: `${imagePaths.length} images uploaded successfully`,
      data: { imagePaths }
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading images',
      error: error.message
    });
  }
};

// Update dorm
exports.updateDorm = async (req, res) => {
  try {
    const { name, description, price, beds, block, amenities, isPopular, rating, image, images } = req.body;

    // Fetch dorm before update for audit logging
    const dormBefore = await Dorm.findById(req.params.id);
    if (!dormBefore) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    const updateData = {
      name,
      description,
      price,
      beds,
      block,
      amenities,
      isPopular,
      rating,
      image: image || (images && images.length > 0 ? images[0] : ''),
      images: images || (image ? [image] : [])
    };

    const dorm = await Dorm.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      targetType: 'Dorm',
      targetId: dorm._id,
      targetName: dorm.name,
      before: dormBefore,
      after: dorm,
      req
    });

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
    const dorm = await Dorm.findById(req.params.id);

    if (!dorm) {
      return res.status(404).json({
        success: false,
        message: 'Dorm not found'
      });
    }

    // Store dorm data before deletion for audit log
    const dormData = dorm.toObject();

    // Delete images from Cloudinary
    const allImages = [...(dorm.images || [])];
    if (dorm.image && !allImages.includes(dorm.image)) {
      allImages.push(dorm.image);
    }

    for (const imageUrl of allImages) {
      if (imageUrl && imageUrl.includes('cloudinary.com')) {
        const publicId = getPublicIdFromUrl(imageUrl);
        if (publicId) {
          try {
            await deleteFromCloudinary(publicId);
          } catch (err) {
            console.error('Error deleting image from Cloudinary:', err);
          }
        }
      }
    }

    await Dorm.findByIdAndDelete(req.params.id);

    // Create audit log
    await createAuditLog({
      action: 'DELETE',
      targetType: 'Dorm',
      targetId: dormData._id,
      targetName: dormData.name,
      before: dormData,
      req
    });

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

    // Fetch user before update for audit logging
    const userBefore = await User.findById(req.params.id).select('-password');
    if (!userBefore) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, phone, isActive },
      { new: true, runValidators: true }
    ).select('-password');

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      targetType: 'User',
      targetId: user._id,
      targetName: user.name,
      before: userBefore,
      after: user,
      req
    });

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
    // Fetch user before deletion for audit logging
    const userBefore = await User.findById(req.params.id).select('-password');
    if (!userBefore) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store user data before deletion
    const userData = userBefore.toObject();

    await User.findByIdAndDelete(req.params.id);

    // Create audit log
    await createAuditLog({
      action: 'DELETE',
      targetType: 'User',
      targetId: userData._id,
      targetName: userData.name,
      before: userData,
      req
    });

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

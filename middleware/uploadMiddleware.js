const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directories exist (for local fallback)
const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage - use memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Create multer upload instance - use memory storage for Cloudinary
const uploadAvatar = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1 // Only 1 file at a time
  }
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 5MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Only 1 file allowed.'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next();
};

// Helper to delete old avatar file (handles both local and Cloudinary)
const deleteOldAvatar = async (avatarPath) => {
  // Handle Cloudinary URLs
  if (avatarPath && avatarPath.includes('cloudinary.com')) {
    const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');
    const publicId = getPublicIdFromUrl(avatarPath);
    if (publicId) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting avatar from Cloudinary:', err);
      }
    }
    return;
  }

  // Handle local files
  if (avatarPath && avatarPath.includes('/uploads/avatars/')) {
    const filename = avatarPath.split('/uploads/avatars/')[1];
    const fullPath = path.join(uploadDir, filename);

    if (fs.existsSync(fullPath)) {
      fs.unlink(fullPath, (err) => {
        if (err) console.error('Error deleting old avatar:', err);
      });
    }
  }
};

// ========== DORM IMAGE UPLOAD ==========

// Ensure dorm images directory exists (for local fallback)
const dormImageDir = path.join(__dirname, '../uploads/dorms');
if (!fs.existsSync(dormImageDir)) {
  fs.mkdirSync(dormImageDir, { recursive: true });
}

// Configure storage for dorm images - use memory storage for Cloudinary
const uploadDormImage = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for dorm images
    files: 5 // Allow up to 5 images
  }
});

// Helper to delete old dorm image (handles both local and Cloudinary)
const deleteOldDormImage = async (imagePath) => {
  // Handle Cloudinary URLs
  if (imagePath && imagePath.includes('cloudinary.com')) {
    const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');
    const publicId = getPublicIdFromUrl(imagePath);
    if (publicId) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
      }
    }
    return;
  }

  // Handle local files
  if (imagePath && imagePath.includes('/uploads/dorms/')) {
    const filename = imagePath.split('/uploads/dorms/')[1];
    const fullPath = path.join(dormImageDir, filename);

    if (fs.existsSync(fullPath)) {
      fs.unlink(fullPath, (err) => {
        if (err) console.error('Error deleting old dorm image:', err);
      });
    }
  }
};

module.exports = {
  uploadAvatar,
  handleUploadError,
  deleteOldAvatar,
  uploadDormImage,
  deleteOldDormImage
};

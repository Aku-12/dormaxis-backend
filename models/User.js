const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 12  // Updated for security
  },
  role: {
    type: String,
    enum: ['student', 'warden', 'admin', 'superadmin'],
    default: 'student'
  },
  phone: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Password Security Fields
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  passwordExpiresAt: {
    type: Date
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },

  // MFA (Multi-Factor Authentication) Fields
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: {
    type: String,
    select: false  // Don't include in queries by default
  },
  mfaBackupCodes: [{
    code: {
      type: String,
      select: false
    },
    used: {
      type: Boolean,
      default: false
    }
  }],
  mfaMethod: {
    type: String,
    enum: ['totp', 'email', 'sms'],
    default: 'totp'
  },

  // Password Reset Fields
  passwordResetCode: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },

  // Login Attempt Tracking (Brute Force Protection)
  loginAttempts: {
    count: {
      type: Number,
      default: 0
    },
    lastAttempt: {
      type: Date
    },
    lockedUntil: {
      type: Date
    }
  },

  // Account Security
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },

  // Session Management
  lastLogin: {
    type: Date
  },
  lastLoginIP: {
    type: String
  },
  lastLoginUserAgent: {
    type: String
  },

  // Profile Information
  avatar: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Nepal'
    }
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },

  // Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },

  // Wishlist - Favorited dorms
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm'
  }]
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'loginAttempts.lockedUntil': 1 });

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
  return this.loginAttempts.lockedUntil && this.loginAttempts.lockedUntil > new Date();
});

// Method to check if password is expired
userSchema.methods.isPasswordExpired = function() {
  if (!this.passwordExpiresAt) return false;
  return new Date() > this.passwordExpiresAt;
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  const LOCK_TIME = 30 * 60 * 1000; // 30 minutes
  const MAX_ATTEMPTS = 5;

  // Reset if lock has expired
  if (this.loginAttempts.lockedUntil && this.loginAttempts.lockedUntil < new Date()) {
    await this.updateOne({
      $set: {
        'loginAttempts.count': 1,
        'loginAttempts.lastAttempt': new Date()
      },
      $unset: { 'loginAttempts.lockedUntil': 1 }
    });
    return;
  }

  const updates = {
    $inc: { 'loginAttempts.count': 1 },
    $set: { 'loginAttempts.lastAttempt': new Date() }
  };

  // Lock account if max attempts exceeded
  if (this.loginAttempts.count + 1 >= MAX_ATTEMPTS) {
    updates.$set['loginAttempts.lockedUntil'] = new Date(Date.now() + LOCK_TIME);
  }

  await this.updateOne(updates);
};

// Method to reset login attempts after successful login
userSchema.methods.resetLoginAttempts = async function() {
  await this.updateOne({
    $set: {
      'loginAttempts.count': 0,
      'lastLogin': new Date()
    },
    $unset: {
      'loginAttempts.lockedUntil': 1
    }
  });
};

module.exports = mongoose.model('User', userSchema);

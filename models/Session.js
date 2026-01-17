const mongoose = require('mongoose');

/**
 * Session Schema
 * Tracks active user sessions for concurrent session limiting
 */
const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
});

// Index for cleanup of expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Check if session is expired (idle timeout or max session)
 */
sessionSchema.methods.isExpired = function() {
  const now = new Date();
  const idleTimeout = 15 * 60 * 1000; // 15 minutes
  const idleExpired = (now - this.lastActivity) > idleTimeout;
  const maxExpired = now > this.expiresAt;
  
  return idleExpired || maxExpired;
};

/**
 * Update last activity timestamp
 */
sessionSchema.methods.touch = async function() {
  this.lastActivity = new Date();
  await this.save();
};

/**
 * Static: Get active session count for user
 */
sessionSchema.statics.getActiveSessionCount = async function(userId) {
  const idleTimeout = new Date(Date.now() - 15 * 60 * 1000);
  return await this.countDocuments({
    userId,
    lastActivity: { $gt: idleTimeout },
    expiresAt: { $gt: new Date() }
  });
};

/**
 * Static: Remove oldest session for user
 */
sessionSchema.statics.removeOldestSession = async function(userId) {
  const oldest = await this.findOne({ userId }).sort({ createdAt: 1 });
  if (oldest) {
    await oldest.deleteOne();
  }
};

/**
 * Static: Clean up expired sessions
 */
sessionSchema.statics.cleanupExpired = async function() {
  const idleTimeout = new Date(Date.now() - 15 * 60 * 1000);
  await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { lastActivity: { $lt: idleTimeout } }
    ]
  });
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;

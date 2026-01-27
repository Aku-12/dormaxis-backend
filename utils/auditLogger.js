const AuditLog = require('../models/AuditLog');

// Fields to sanitize from audit logs (sensitive data)
const SENSITIVE_FIELDS = [
  'password',
  'mfaSecret',
  'mfaBackupCodes',
  'passwordResetCode',
  'passwordResetToken',
  'passwordResetExpires',
  'emailVerificationToken',
  'emailVerificationExpires',
  'loginAttempts'
];

/**
 * Sanitize sensitive fields from an object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
const sanitizeData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };

  // Handle Mongoose documents
  if (sanitized.toObject) {
    return sanitizeData(sanitized.toObject());
  }

  // Handle _doc property from Mongoose
  if (sanitized._doc) {
    return sanitizeData(sanitized._doc);
  }

  SENSITIVE_FIELDS.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  // Remove internal mongoose fields
  delete sanitized.__v;

  return sanitized;
};

/**
 * Get client IP address from request (handles proxies)
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

/**
 * Calculate changed fields between before and after states
 * @param {Object} before - State before change
 * @param {Object} after - State after change
 * @returns {Object} - Object containing only changed fields
 */
const getChangedFields = (before, after) => {
  if (!before || !after) return { before, after };

  const changedBefore = {};
  const changedAfter = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  allKeys.forEach(key => {
    const beforeVal = JSON.stringify(before[key]);
    const afterVal = JSON.stringify(after[key]);

    if (beforeVal !== afterVal) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  });

  return {
    before: Object.keys(changedBefore).length > 0 ? changedBefore : null,
    after: Object.keys(changedAfter).length > 0 ? changedAfter : null
  };
};

/**
 * Create an audit log entry
 * @param {Object} options - Audit log options
 * @param {string} options.action - CREATE | UPDATE | DELETE
 * @param {string} options.targetType - Dorm | User | Booking
 * @param {string} options.targetId - ID of the target entity
 * @param {string} options.targetName - Display name of the target
 * @param {Object} options.before - State before change (for UPDATE/DELETE)
 * @param {Object} options.after - State after change (for CREATE/UPDATE)
 * @param {Object} options.req - Express request object
 * @returns {Promise<Object>} - Created audit log entry
 */
const createAuditLog = async ({
  action,
  targetType,
  targetId,
  targetName,
  before = null,
  after = null,
  req
}) => {
  try {
    console.log(`[AuditLog] Attempting to create log: ${action} ${targetType} - ${targetName}`);

    if (!req.user) {
      console.error('[AuditLog] Failed: req.user is missing');
      return null;
    }

    // Sanitize sensitive data
    const sanitizedBefore = sanitizeData(before);
    const sanitizedAfter = sanitizeData(after);

    // For updates, only store changed fields
    let changes;
    if (action === 'UPDATE') {
      changes = getChangedFields(sanitizedBefore, sanitizedAfter);
    } else {
      changes = {
        before: sanitizedBefore,
        after: sanitizedAfter
      };
    }

    const performedBy = req.user._id || req.user.id;
    if (!performedBy) {
        console.error('[AuditLog] Failed: user ID missing from req.user', req.user);
        return null;
    }

    const auditLog = new AuditLog({
      action,
      targetType,
      targetId,
      targetName,
      changes,
      performedBy: performedBy, // Mongoose expects ObjectId or hex string
      performedByName: req.user.name || 'Unknown',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] || ''
    });

    // Save asynchronously without blocking the main response
    await auditLog.save();
    console.log(`[AuditLog] Successfully saved log ID: ${auditLog._id}`);

    return auditLog;
  } catch (error) {
    // Log error but don't throw - audit logging shouldn't break main functionality
    console.error('[AuditLog] Error creating audit log:', error);
    console.error('[AuditLog] Stack:', error.stack);
    return null;
  }
};

module.exports = {
  createAuditLog,
  sanitizeData,
  getClientIP,
  getChangedFields
};

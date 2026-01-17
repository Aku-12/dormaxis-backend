/**
 * Input Sanitizer Middleware
 * Protects against XSS, NoSQL injection, and other input-based attacks
 */

const mongoSanitize = require('mongo-sanitize');

/**
 * Recursively sanitize an object for NoSQL injection
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
const sanitizeObject = (data) => {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeObject(item));
  }

  if (typeof data === 'object') {
    const sanitized = {};
    for (const key of Object.keys(data)) {
      // Remove keys that start with $ (MongoDB operators)
      if (key.startsWith('$')) {
        continue;
      }
      sanitized[key] = sanitizeObject(data[key]);
    }
    return mongoSanitize(sanitized);
  }

  if (typeof data === 'string') {
    // Remove null bytes
    return data.replace(/\0/g, '');
  }

  return data;
};

/**
 * Sanitize HTML entities to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const escapeHtml = (str) => {
  if (typeof str !== 'string') {
    return str;
  }
  
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
};

/**
 * Recursively escape HTML in object values
 * @param {any} data - Data to escape
 * @returns {any} - Escaped data
 */
const escapeHtmlInObject = (data) => {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => escapeHtmlInObject(item));
  }

  if (typeof data === 'object') {
    const escaped = {};
    for (const key of Object.keys(data)) {
      escaped[key] = escapeHtmlInObject(data[key]);
    }
    return escaped;
  }

  if (typeof data === 'string') {
    return escapeHtml(data);
  }

  return data;
};

/**
 * Remove potentially dangerous patterns from strings
 * @param {string} str - String to clean
 * @returns {string} - Cleaned string
 */
const removeDangerousPatterns = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove script tags
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  str = str.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: URLs
  str = str.replace(/javascript:/gi, '');
  
  // Remove data: URLs (can contain scripts)
  str = str.replace(/data:/gi, '');
  
  // Remove vbscript: URLs
  str = str.replace(/vbscript:/gi, '');

  return str;
};

/**
 * Main sanitization middleware for request body, query, and params
 */
const sanitizeInputs = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * XSS protection middleware - escapes HTML entities
 * Use this for endpoints that don't need HTML input
 */
const xssProtection = (req, res, next) => {
  // Escape HTML in body
  if (req.body) {
    // Don't escape password fields
    const passwordFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword'];
    const escapedBody = {};
    
    for (const key of Object.keys(req.body)) {
      if (passwordFields.includes(key)) {
        escapedBody[key] = req.body[key];
      } else if (typeof req.body[key] === 'string') {
        escapedBody[key] = removeDangerousPatterns(req.body[key]);
      } else {
        escapedBody[key] = req.body[key];
      }
    }
    
    req.body = escapedBody;
  }

  next();
};

/**
 * Validate content type for POST/PUT/PATCH requests
 */
const validateContentType = (req, res, next) => {
  const methodsWithBody = ['POST', 'PUT', 'PATCH'];

  if (methodsWithBody.includes(req.method)) {
    const contentType = req.get('Content-Type');

    // Allow multipart/form-data for file uploads (body may be undefined at this point)
    if (contentType?.includes('multipart/form-data')) {
      return next();
    }

    // Allow requests without body
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }

    // Check for valid content type
    if (!contentType || !contentType.includes('application/json')) {
      // Also allow form data
      if (!contentType?.includes('application/x-www-form-urlencoded')) {
        return res.status(415).json({
          success: false,
          error: 'Unsupported Media Type. Expected application/json',
        });
      }
    }
  }

  next();
};

/**
 * Trim whitespace from string inputs
 */
const trimInputs = (req, res, next) => {
  const trimStrings = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const trimmed = Array.isArray(obj) ? [] : {};
    
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        // Don't trim passwords
        if (!key.toLowerCase().includes('password')) {
          trimmed[key] = obj[key].trim();
        } else {
          trimmed[key] = obj[key];
        }
      } else if (typeof obj[key] === 'object') {
        trimmed[key] = trimStrings(obj[key]);
      } else {
        trimmed[key] = obj[key];
      }
    }
    
    return trimmed;
  };

  if (req.body) {
    req.body = trimStrings(req.body);
  }

  next();
};

module.exports = {
  sanitizeInputs,
  xssProtection,
  validateContentType,
  trimInputs,
  escapeHtml,
  sanitizeObject,
};

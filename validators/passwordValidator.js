/**
 * Password Validator
 * Comprehensive password validation with complexity checks
 */

const securityConfig = require('../config/security.config');

const { password: passwordPolicy } = securityConfig;

/**
 * Validate password complexity requirements
 * @param {string} password - The password to validate
 * @returns {Object} - { isValid: boolean, errors: string[], strength: number }
 */
const validatePasswordComplexity = (password) => {
  const errors = [];
  let strength = 0;

  // Check minimum length
  if (!password || password.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
  } else {
    strength += 1;
  }

  // Check maximum length
  if (password && password.length > passwordPolicy.maxLength) {
    errors.push(`Password must not exceed ${passwordPolicy.maxLength} characters`);
  }

  // Check for uppercase letters
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    strength += 1;
  }

  // Check for lowercase letters
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    strength += 0.5;
  }

  // Check for numbers
  if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/\d/.test(password)) {
    strength += 1;
  }

  // Check for special characters
  const symbolRegex = new RegExp(`[${passwordPolicy.symbols.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
  if (passwordPolicy.requireSymbols && !symbolRegex.test(password)) {
    errors.push(`Password must contain at least one special character (${passwordPolicy.symbols})`);
  } else if (symbolRegex.test(password)) {
    strength += 1;
  }

  // Check for common weak patterns
  const weakPatterns = [
    /^(.)\1+$/,                    // Repeating characters
    /^(012|123|234|345|456|567|678|789|890)+$/,  // Sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i,  // Sequential letters
    /password/i,
    /qwerty/i,
    /admin/i,
    /user/i,
    /login/i,
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains a common weak pattern');
      strength = Math.max(0, strength - 1);
      break;
    }
  }

  // Bonus for length > 16
  if (password && password.length >= 16) {
    strength += 0.5;
  }

  // Normalize strength to 0-4 scale
  const normalizedStrength = Math.min(4, Math.max(0, Math.floor(strength)));

  return {
    isValid: errors.length === 0,
    errors,
    strength: normalizedStrength,
    strengthLabel: securityConfig.strengthLevels[normalizedStrength]?.label || 'Unknown',
  };
};



/**
 * Check if password has expired
 * @param {Date} passwordExpiresAt - Password expiry date
 * @returns {Object} - { isExpired: boolean, daysUntilExpiry: number, shouldWarn: boolean }
 */
const isPasswordExpired = (passwordExpiresAt) => {
  if (!passwordExpiresAt) {
    return { isExpired: false, daysUntilExpiry: null, shouldWarn: false };
  }

  const now = new Date();
  const expiryDate = new Date(passwordExpiresAt);
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    isExpired: diffDays <= 0,
    daysUntilExpiry: Math.max(0, diffDays),
    shouldWarn: diffDays > 0 && diffDays <= passwordPolicy.warningDays,
  };
};

/**
 * Calculate password expiry date from now
 * @returns {Date} - Password expiry date
 */
const calculatePasswordExpiry = () => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + passwordPolicy.expiryDays);
  return expiryDate;
};

/**
 * Get password requirements for display
 * @returns {Object[]} - Array of requirement objects
 */
const getPasswordRequirements = () => {
  return [
    {
      id: 'length',
      label: `At least ${passwordPolicy.minLength} characters`,
      regex: new RegExp(`.{${passwordPolicy.minLength},}`),
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      regex: /[A-Z]/,
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      regex: /[a-z]/,
    },
    {
      id: 'number',
      label: 'At least one number (0-9)',
      regex: /\d/,
    },
    {
      id: 'symbol',
      label: `At least one special character (${passwordPolicy.symbols})`,
      regex: new RegExp(`[${passwordPolicy.symbols.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`),
    },
  ];
};

module.exports = {
  validatePasswordComplexity,
  isPasswordExpired,
  calculatePasswordExpiry,
  getPasswordRequirements,
  passwordPolicy,
};

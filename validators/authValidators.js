const { body, validationResult } = require('express-validator');
const { validatePasswordComplexity, getPasswordRequirements } = require('./passwordValidator');

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Custom password validator
const passwordComplexityValidator = (value) => {
  const result = validatePasswordComplexity(value);
  if (!result.isValid) {
    throw new Error(result.errors[0]);
  }
  return true;
};

// Register validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes')
    .customSanitizer(value => {
      // Remove multiple spaces and trim
      return value.replace(/\s+/g, ' ').trim();
    }),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email is too long'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 12, max: 128 })
    .withMessage('Password must be between 12 and 128 characters')
    .custom(passwordComplexityValidator),

  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  body('phone')
    .optional()
    .trim()
    .customSanitizer(value => value.replace(/[\s\-]/g, ''))
    .matches(/^(\+977)?[0-9]{10,11}$/)
    .withMessage('Please provide a valid phone number (10-11 digits, optionally with +977)'),

  handleValidationErrors
];

// Login validation rules
const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password is too long'),

  handleValidationErrors
];

// Password change validation rules
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 12, max: 128 })
    .withMessage('New password must be between 12 and 128 characters')
    .custom(passwordComplexityValidator)
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  body('confirmNewPassword')
    .notEmpty()
    .withMessage('Please confirm your new password')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  handleValidationErrors
];

// Profile update validation rules
const profileUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('phone')
    .optional()
    .trim()
    .customSanitizer(value => value ? value.replace(/[\s\-]/g, '') : value)
    .custom((value) => {
      if (value && !/^(\+977)?[0-9]{10,11}$/.test(value)) {
        throw new Error('Please provide a valid phone number');
      }
      return true;
    }),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const minAge = 16;
      const maxAge = 100;
      
      const age = Math.floor((now - date) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (age < minAge || age > maxAge) {
        throw new Error(`Age must be between ${minAge} and ${maxAge} years`);
      }
      return true;
    }),

  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address is too long'),

  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City name is too long'),

  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State name is too long'),

  body('address.zipCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Zip code is too long'),

  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),

  body('emergencyContact.phone')
    .optional()
    .trim()
    .customSanitizer(value => value ? value.replace(/[\s\-]/g, '') : value)
    .custom((value) => {
      if (value && !/^(\+977)?[0-9]{10,11}$/.test(value)) {
        throw new Error('Please provide a valid emergency contact phone number');
      }
      return true;
    }),

  body('emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Relationship field is too long'),

  handleValidationErrors
];

// Get password requirements endpoint
const getPasswordRequirementsInfo = (req, res) => {
  res.json({
    success: true,
    data: {
      requirements: getPasswordRequirements(),
      policy: {
        minLength: 12,
        maxLength: 128,
        expiryDays: 90,
        historyCount: 5
      }
    }
  });
};

module.exports = {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  profileUpdateValidation,
  handleValidationErrors,
  getPasswordRequirementsInfo
};

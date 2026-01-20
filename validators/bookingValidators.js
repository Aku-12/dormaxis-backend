const { body, validationResult } = require('express-validator');

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

// Create booking validation rules
const createBookingValidation = [
  body('dormId')
    .notEmpty()
    .withMessage('Dorm ID is required')
    .isMongoId()
    .withMessage('Invalid dorm ID'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email is too long'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .customSanitizer(value => value.replace(/[\s\-]/g, ''))
    .matches(/^(\+977)?[0-9]{10,11}$/)
    .withMessage('Please provide a valid phone number (10-11 digits)'),

  body('numberOfOccupants')
    .notEmpty()
    .withMessage('Number of occupants is required')
    .isInt({ min: 1, max: 4 })
    .withMessage('Number of occupants must be between 1 and 4'),

  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['esewa', 'khalti', 'bank_transfer', 'cash'])
    .withMessage('Invalid payment method'),

  body('termsAccepted')
    .isBoolean()
    .withMessage('Terms acceptance must be a boolean')
    .custom(value => {
      if (value !== true) {
        throw new Error('You must accept the terms and conditions');
      }
      return true;
    }),

  body('promoCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Promo code is too long'),

  handleValidationErrors
];

// Validate promo code validation rules
const validatePromoCodeValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required')
    .isLength({ max: 20 })
    .withMessage('Promo code is too long'),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number'),

  handleValidationErrors
];

// Update booking status validation
const updateBookingStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid status'),

  handleValidationErrors
];

module.exports = {
  createBookingValidation,
  validatePromoCodeValidation,
  updateBookingStatusValidation
};

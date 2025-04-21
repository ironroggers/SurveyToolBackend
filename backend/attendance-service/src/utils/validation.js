import { body, param, query, validationResult } from 'express-validator';

// Middleware to check validation results
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

// Attendance check-in validation
export const checkInValidation = [
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  body('location.latitude')
    .optional()
    .isFloat()
    .withMessage('Latitude must be a number'),
  body('location.longitude')
    .optional()
    .isFloat()
    .withMessage('Longitude must be a number'),
  body('location.address')
    .optional()
    .isString()
    .withMessage('Address must be a string'),
  validate
];

// Justification validation
export const justificationValidation = [
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid date in ISO format'),
  body('justification')
    .isString()
    .notEmpty()
    .withMessage('Justification is required')
    .isLength({ min: 5, max: 500 })
    .withMessage('Justification must be between 5 and 500 characters'),
  validate
];

// Process justification validation
export const processJustificationValidation = [
  param('attendanceId')
    .isMongoId()
    .withMessage('Invalid attendance ID'),
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either "approved" or "rejected"'),
  validate
];

// Attendance history query validation
export const historyQueryValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date in ISO format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date in ISO format'),
  query('status')
    .optional()
    .isIn(['present', 'absent', 'late'])
    .withMessage('Status must be one of: present, absent, late'),
  validate
];

// Admin attendance list query validation
export const adminQueryValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date in ISO format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date in ISO format'),
  query('status')
    .optional()
    .isIn(['present', 'absent', 'late'])
    .withMessage('Status must be one of: present, absent, late'),
  query('userId')
    .optional()
    .isString()
    .withMessage('User ID must be a string'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate
]; 
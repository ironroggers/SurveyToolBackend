import { body } from 'express-validator';
import { validateRequest } from '../utils/validator.js';

export const validateSurvey = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters long'),

  body('description')
    .optional()
    .trim(),

  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .isMongoId()
    .withMessage('Invalid location ID'),

  body('latlong')
    .notEmpty()
    .withMessage('Latlong is required')
    .isArray()
    .withMessage('Latlong must be an array')
    .custom((coords) => {
      if (!coords || coords.length !== 2) {
        throw new Error('Latlong must contain exactly 2 values [latitude, longitude]');
      }
      const [latitude, longitude] = coords;
      if (latitude < -90 || latitude > 90) {
        throw new Error('Invalid latitude (must be between -90 and 90)');
      }
      if (longitude < -180 || longitude > 180) {
        throw new Error('Invalid longitude (must be between -180 and 180)');
      }
      return true;
    }),

  body('created_by')
    .notEmpty()
    .withMessage('Creator is required')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('rowAuthority')
    .optional()
    .isIn(['NHAI', 'NH', 'State Highway', 'Forest', 'Municipal Coorporation', 'Municipality', 'Gram Panchayat', 'Railway', 'Private Road', 'Others'])
    .withMessage('Invalid row authority type'),

  body('others')
    .optional(),

  body('terrainData.existingInfrastructure')
    .optional()
    .isArray()
    .withMessage('Existing infrastructure must be an array')
    .custom((values) => {
      const validTypes = ['POLES', 'DUCTS', 'MANHOLES', 'FIBER_CABLES', 'NONE'];
      if (!values.every(type => validTypes.includes(type))) {
        throw new Error('Invalid infrastructure type');
      }
      return true;
    }),

  body('mediaFiles.*.url')
    .optional()
    .isURL()
    .withMessage('Invalid media file URL'),

  body('mediaFiles.*.fileType')
    .optional()
    .isIn(['IMAGE', 'VIDEO', 'DOCUMENT'])
    .withMessage('Invalid file type'),

  validateRequest
];

export const validateMediaFile = [
  body('url')
    .notEmpty()
    .withMessage('URL is required')
    .isURL()
    .withMessage('Invalid URL format'),

  body('fileType')
    .notEmpty()
    .withMessage('File type is required')
    .isIn(['IMAGE', 'VIDEO', 'DOCUMENT'])
    .withMessage('Invalid file type'),

  body('description')
    .optional()
    .trim(),

  validateRequest
];

export const validateComment = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ min: 3 })
    .withMessage('Comment must be at least 3 characters long'),

  validateRequest
];

export const validateStatusUpdate = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isNumeric()
    .withMessage('Status must be a number'),

  body('rejectionReason')
    .if(body('status').equals('REJECTED'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting a survey')
    .isLength({ min: 10 })
    .withMessage('Rejection reason must be at least 10 characters long'),

  validateRequest
]; 
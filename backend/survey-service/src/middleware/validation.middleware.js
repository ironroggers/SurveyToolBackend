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

  body('terrainData.terrainType')
    .notEmpty()
    .withMessage('Terrain type is required')
    .isIn(['URBAN', 'RURAL', 'FOREST', 'MOUNTAIN', 'WETLAND', 'COASTAL'])
    .withMessage('Invalid terrain type'),

  body('terrainData.elevation')
    .notEmpty()
    .withMessage('Elevation is required')
    .isFloat({ min: 0 })
    .withMessage('Elevation must be a positive number'),

  body('terrainData.centerPoint.coordinates')
    .notEmpty()
    .withMessage('Terrain center point coordinates are required')
    .isArray()
    .withMessage('Coordinates must be an array')
    .custom((coords) => {
      if (!coords || coords.length !== 2) {
        throw new Error('Coordinates must contain exactly 2 values [longitude, latitude]');
      }
      const [longitude, latitude] = coords;
      if (longitude < -180 || longitude > 180) {
        throw new Error('Invalid longitude (must be between -180 and 180)');
      }
      if (latitude < -90 || latitude > 90) {
        throw new Error('Invalid latitude (must be between -90 and 90)');
      }
      return true;
    }),

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

  body('assignedTo')
    .notEmpty()
    .withMessage('Assigned surveyor is required')
    .isMongoId()
    .withMessage('Invalid surveyor ID'),

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
    .isIn(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'])
    .withMessage('Invalid status'),

  body('rejectionReason')
    .if(body('status').equals('REJECTED'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting a survey')
    .isLength({ min: 10 })
    .withMessage('Rejection reason must be at least 10 characters long'),

  validateRequest
]; 
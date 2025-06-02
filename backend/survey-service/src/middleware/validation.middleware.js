import { body } from 'express-validator';
import { validateRequest } from '../utils/validator.js';

export const validateSurvey = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Survey name is required')
    .isLength({ min: 3 })
    .withMessage('Name must be at least 3 characters long'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),

  body('locationId')
    .notEmpty()
    .withMessage('Location ID is required')
    .isMongoId()
    .withMessage('Invalid location ID'),

  body('latitude')
    .notEmpty()
    .withMessage('Latitude is required')
    .trim(),

  body('longitude')
    .notEmpty()
    .withMessage('Longitude is required')
    .trim(),

  body('surveyType')
    .notEmpty()
    .withMessage('Survey type is required')
    .isIn(['block', 'gp', 'ofc'])
    .withMessage('Survey type must be block, gp, or ofc'),

  body('createdBy')
    .notEmpty()
    .withMessage('Creator is required')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('updatedBy')
    .notEmpty()
    .withMessage('Updater is required')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('stateName')
    .optional()
    .trim(),

  body('stateCode')
    .optional()
    .trim(),

  body('districtName')
    .optional()
    .trim(),

  body('districtCode')
    .optional()
    .trim(),

  body('blockName')
    .optional()
    .trim(),

  body('blockCode')
    .optional()
    .trim(),

  body('blockAddress')
    .optional()
    .trim(),

  body('contactPerson.sdeName')
    .optional()
    .trim(),

  body('contactPerson.sdeMobile')
    .optional()
    .trim(),

  body('contactPerson.engineerName')
    .optional()
    .trim(),

  body('contactPerson.engineerMobile')
    .optional()
    .trim(),

  body('contactPerson.address')
    .optional()
    .trim(),

  body('fields.*.sequence')
    .optional()
    .isNumeric()
    .withMessage('Field sequence must be a number'),

  body('fields.*.key')
    .if(body('fields').exists())
    .notEmpty()
    .withMessage('Field key is required')
    .trim(),

  body('fields.*.fieldType')
    .if(body('fields').exists())
    .notEmpty()
    .withMessage('Field type is required')
    .isIn(['dropdown', 'text'])
    .withMessage('Field type must be dropdown or text'),

  body('mediaFiles.*.url')
    .optional()
    .isURL()
    .withMessage('Invalid media file URL'),

  body('mediaFiles.*.fileType')
    .optional()
    .isIn(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'])
    .withMessage('Invalid file type'),

  body('mediaFiles.*.latitude')
    .if(body('mediaFiles').exists())
    .notEmpty()
    .withMessage('Latitude is required for media files')
    .trim(),

  body('mediaFiles.*.longitude')
    .if(body('mediaFiles').exists())
    .notEmpty()
    .withMessage('Longitude is required for media files')
    .trim(),

  body('mediaFiles.*.uploadedAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid upload date format'),

  body('fields.*.mediaFiles.*.uploadedAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid upload date format in field media files'),

  body('others')
    .optional(),

  validateRequest
];

export const validateSurveyUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Name must be at least 3 characters long'),

  body('description')
    .optional()
    .trim(),

  body('locationId')
    .optional()
    .isMongoId()
    .withMessage('Invalid location ID'),

  body('latitude')
    .optional()
    .trim(),

  body('longitude')
    .optional()
    .trim(),

  body('surveyType')
    .optional()
    .isIn(['block', 'gp', 'ofc'])
    .withMessage('Survey type must be block, gp, or ofc'),

  body('updatedBy')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('stateName')
    .optional()
    .trim(),

  body('stateCode')
    .optional()
    .trim(),

  body('districtName')
    .optional()
    .trim(),

  body('districtCode')
    .optional()
    .trim(),

  body('blockName')
    .optional()
    .trim(),

  body('blockCode')
    .optional()
    .trim(),

  body('blockAddress')
    .optional()
    .trim(),

  body('contactPerson.sdeName')
    .optional()
    .trim(),

  body('contactPerson.sdeMobile')
    .optional()
    .trim(),

  body('contactPerson.engineerName')
    .optional()
    .trim(),

  body('contactPerson.engineerMobile')
    .optional()
    .trim(),

  body('contactPerson.address')
    .optional()
    .trim(),

  body('fields.*.sequence')
    .optional()
    .isNumeric()
    .withMessage('Field sequence must be a number'),

  body('fields.*.key')
    .if(body('fields').exists())
    .optional()
    .trim(),

  body('fields.*.fieldType')
    .if(body('fields').exists())
    .optional()
    .isIn(['dropdown', 'text'])
    .withMessage('Field type must be dropdown or text'),

  body('others')
    .optional(),

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
    .isIn(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'])
    .withMessage('Invalid file type'),

  body('description')
    .optional()
    .trim(),
    
  body('latitude')
    .notEmpty()
    .withMessage('Latitude is required for media files')
    .trim(),
    
  body('longitude')
    .notEmpty()
    .withMessage('Longitude is required for media files')
    .trim(),
    
  body('deviceName')
    .optional()
    .trim(),
    
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number'),
    
  body('place')
    .optional()
    .trim(),

  body('uploadedAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid upload date format'),

  validateRequest
];

export const validateField = [
  body('sequence')
    .notEmpty()
    .withMessage('Field sequence is required')
    .isNumeric()
    .withMessage('Sequence must be a number'),

  body('key')
    .trim()
    .notEmpty()
    .withMessage('Field key is required'),

  body('value')
    .optional()
    .trim(),

  body('fieldType')
    .notEmpty()
    .withMessage('Field type is required')
    .isIn(['dropdown', 'text'])
    .withMessage('Field type must be dropdown or text'),

  body('dropdownOptions')
    .if(body('fieldType').equals('dropdown'))
    .isArray()
    .withMessage('Dropdown options must be an array')
    .custom((options) => {
      if (options.length === 0) {
        throw new Error('Dropdown must have at least one option');
      }
      return true;
    }),

  validateRequest
];

export const validateStatusUpdate = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isNumeric()
    .withMessage('Status must be a number'),

  body('updatedBy')
    .notEmpty()
    .withMessage('Updater is required')
    .isMongoId()
    .withMessage('Invalid user ID'),

  validateRequest
]; 
import { validationResult } from 'express-validator';
import { BadRequestError } from './errors.js';

export const validateRequest = (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg);
      throw new BadRequestError(errorMessages[0]); // Send first error message
    }
    next();
  } catch (error) {
    next(error);
  }
}; 
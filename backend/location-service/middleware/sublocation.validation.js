import { body } from "express-validator";
import { validateRequest } from "../utils/validator.js";

export const validateSublocation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3 })
    .withMessage("Title must be at least 3 characters long"),

  body("surveyId")
    .optional()
    .isMongoId()
    .withMessage("Invalid Survey ID format"),

  body("centerPoint")
    .notEmpty()
    .withMessage("Center point is required"),

  body("centerPoint.type")
    .equals("Point")
    .withMessage("Center point type must be Point"),

  body("centerPoint.coordinates")
    .isArray()
    .withMessage("Center point coordinates must be an array")
    .custom((coords) => {
      if (!coords || coords.length !== 2) {
        throw new Error("Center point must have exactly 2 coordinates [longitude, latitude]");
      }
      const [longitude, latitude] = coords;
      if (longitude < -180 || longitude > 180) {
        throw new Error("Invalid longitude (must be between -180 and 180)");
      }
      if (latitude < -90 || latitude > 90) {
        throw new Error("Invalid latitude (must be between -90 and 90)");
      }
      return true;
    }),

  body("location")
    .notEmpty()
    .withMessage("Location ID is required")
    .isMongoId()
    .withMessage("Invalid Location ID format"),

  validateRequest,
]; 
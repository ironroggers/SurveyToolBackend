import { body } from "express-validator";
import { validateRequest } from "../utils/validator.js";

export const validateLocation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3 })
    .withMessage("Title must be at least 3 characters long"),

  body("surveyId")
    .notEmpty()
    .withMessage("Survey ID is required")
    .isMongoId()
    .withMessage("Invalid Survey ID format"),

  body("geofence")
    .notEmpty()
    .withMessage("Geofence is required"),

  body("geofence.type")
    .equals("Polygon")
    .withMessage("Geofence type must be Polygon"),

  body("geofence.coordinates")
    .isArray()
    .withMessage("Geofence coordinates must be an array")
    .custom((coords) => {
      if (!coords || !coords.length || !coords[0] || coords[0].length < 3) {
        throw new Error("Polygon must have at least 3 points");
      }
      // Check if first and last points are the same (closed polygon)
      const firstPoint = coords[0][0];
      const lastPoint = coords[0][coords[0].length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        throw new Error("Polygon must be closed (first and last points must be the same)");
      }
      return true;
    }),

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

  body("radius")
    .notEmpty()
    .withMessage("Radius is required")
    .isFloat({ min: 0 })
    .withMessage("Radius must be a positive number")
    .custom((value) => {
      if (value > 100000) { // 100km max radius
        throw new Error("Radius cannot exceed 100km");
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(["ACTIVE", "INACTIVE", "COMPLETED"])
    .withMessage("Invalid status value"),

  body("assignedTo")
    .notEmpty()
    .withMessage("Assigned user is required")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  validateRequest,
];

import { body } from "express-validator";
import { validateRequest } from "../utils/validator.js";

export const validateLocation = [
  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required"),

  body("block")
    .trim()
    .notEmpty()
    .withMessage("Block is required"),

  body("route")
    .optional()
    .isArray()
    .withMessage("Route must be an array"),

  body("route.*.to_place")
    .if(body("route").exists())
    .notEmpty()
    .withMessage("To place is required for each route item"),

  body("status")
    .isInt({ min: 1, max: 5 })
    .withMessage("Status must be a number between 1-5 (1: Released, 2: Assigned, 3: Active, 4: Accepted, 5: Reverted)"),

  body("assigned_to")
    .optional()
    .isMongoId()
    .withMessage("Invalid assigned_to ID format"),

  body("surveyor")
    .optional()
    .isMongoId()
    .withMessage("Invalid surveyor ID format"),

  body("supervisor")
    .optional()
    .isMongoId()
    .withMessage("Invalid supervisor ID format"),

  body("start_date")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date-time"),

  body("end_date")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date-time"),

  body("due_date")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid date"),

  body("updated_on")
    .optional()
    .isISO8601()
    .withMessage("Updated on must be a valid date-time"),

  body("time_taken")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Time taken must be a positive number in minutes"),

  body("comments")
    .optional()
    .isString()
    .withMessage("Comments must be a string"),

  validateRequest,
];

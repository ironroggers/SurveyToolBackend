import { body } from "express-validator";
import { validateRequest } from "../utils/validator.js";
import { PROJECT_OPTIONS } from "../utils/constants.js";

export const validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long"),
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .isIn(["SURVEYOR", "SUPERVISOR", "ADMIN", "PERFORMER", "VIEWER"])
    .withMessage("Invalid role"),
  body("project")
    .optional()
    .isIn(PROJECT_OPTIONS)
    .withMessage("Invalid project"),
  body("designation")
    .optional()
    .trim()
    .isString()
    .withMessage("Designation must be a string"),
  validateRequest,
];

export const validateLogin = [
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  validateRequest,
];

export const validateUpdate = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email"),
  body("project")
    .optional()
    .isIn(PROJECT_OPTIONS)
    .withMessage("Invalid project"),
  body("designation")
    .optional()
    .trim()
    .isString()
    .withMessage("Designation must be a string"),
  validateRequest,
];

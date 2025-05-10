import { body } from "express-validator";
import { validateRequest } from "../utils/validator.js";

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
    .isIn(["SURVEYOR", "SUPERVISOR", "ADMIN"])
    .withMessage("Invalid role"),
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
  body("designation")
    .optional()
    .trim()
    .isString()
    .withMessage("Designation must be a string"),
  validateRequest,
];

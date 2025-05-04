import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  getPotentialManagers,
  getAllUsers,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  validateRegister,
  validateLogin,
  validateUpdate,
} from "../middleware/validation.middleware.js";

const router = express.Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, validateUpdate, updateProfile);
router.get("/potential-managers", getPotentialManagers);
router.get("/users", getAllUsers);

export default router;

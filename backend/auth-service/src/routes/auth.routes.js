import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  getPotentialManagers,
  getAllUsers,
  deleteUser,
} from "../controllers/auth.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";
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
router.delete("/users/:userId", authorize("ADMIN"), deleteUser);

export default router;

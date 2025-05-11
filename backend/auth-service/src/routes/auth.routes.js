import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  getPotentialManagers,
  getAllUsers,
  deleteUser,
  updateUser,
} from "../controllers/auth.controller.js";
import {
  validateRegister,
  validateLogin,
  validateUpdate,
} from "../middleware/validation.middleware.js";

const router = express.Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.get("/profile", getProfile);
router.put("/profile", validateUpdate, updateProfile);
router.get("/potential-managers", getPotentialManagers);
router.get("/users", getAllUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;

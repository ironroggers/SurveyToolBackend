import express from "express";
import * as ofchotoController from "../controllers/ofchoto.controller.js";

const router = express.Router();

// Get all OFC HOTO records
router.get("/", ofchotoController.getAllOFCHotos);

// Get OFC HOTO by ID
router.get("/:id", ofchotoController.getOFCHotoById);

// Create new OFC HOTO
router.post("/", ofchotoController.createOFCHoto);

// Update OFC HOTO
router.put("/:id", ofchotoController.updateOFCHoto);

// Delete OFC HOTO
router.delete("/:id", ofchotoController.deleteOFCHoto);

export default router;

import express from "express";
import * as blockHOTOController from "../controllers/blockhoto.controller.js";

const router = express.Router();

// Get all HOTO records
router.get("/", blockHOTOController.getAllBlockHOTOs);

// Get HOTO by ID
router.get("/:id", blockHOTOController.getBlockHOTOById);

// Create new HOTO
router.post("/", blockHOTOController.createBlockHOTO);

// Update HOTO
router.put("/:id", blockHOTOController.updateBlockHOTO);

// Delete HOTO
router.delete("/:id", blockHOTOController.deleteBlockHOTO);

export default router;

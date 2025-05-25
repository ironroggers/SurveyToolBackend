import express from "express";
import * as gphotoController from "../controllers/gphoto.controller.js";

const router = express.Router();

// Get all HOTO records
router.get("/", gphotoController.getAllGPhotos);

// Get HOTO by ID
router.get("/:id", gphotoController.getGPhotoById);

// Create new HOTO
router.post("/", gphotoController.createGPhoto);

// Update HOTO
router.put("/:id", gphotoController.updateGPhoto);

// Delete HOTO
router.delete("/:id", gphotoController.deleteGPhoto);

export default router;

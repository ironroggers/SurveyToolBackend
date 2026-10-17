import { Router } from "express";
import {
  getBlockProfilePermissions,
  getBlockProfiles,
  getBlockProfileById,
  createBlockProfile,
  updateBlockProfile,
  deleteBlockProfile,
  addKmlFile,
  removeKmlFile,
} from "../controller/blockProfile.controller.js";

const router = Router();

// Auth is off for now, as on every execution-service route. The comment on each
// route is the action from src/config/permissions.js it should check once auth lands.
router.get("/permissions", getBlockProfilePermissions);
router.get("/", getBlockProfiles); // viewBlockProfile
router.post("/", createBlockProfile); // createBlockProfile
router.get("/:id", getBlockProfileById); // viewBlockProfile
router.put("/:id", updateBlockProfile); // editBlockProfile
router.delete("/:id", deleteBlockProfile); // deleteBlockProfile
router.post("/:id/kml", addKmlFile); // manageKml
router.delete("/:id/kml/:fileId", removeKmlFile); // manageKml

export default router;

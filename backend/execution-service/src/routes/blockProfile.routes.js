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
  getDistricts,
} from "../controller/blockProfile.controller.js";
import { getBlockInfra, saveBlockInfra, getGpInfraList, getGpInfra, saveGpInfra } from "../controller/infra.controller.js";
import { getBlockMap } from "../controller/blockMap.controller.js";
import {
  getBlockEquipment,
  saveBlockEquipment,
  getGpEquipment,
  saveGpEquipment,
  saveBlockEquipmentPhoto,
  saveGpEquipmentPhoto,
  saveBlockMiscItemPhoto,
  saveGpMiscItemPhoto,
} from "../controller/infraEquipment.controller.js";

const router = Router();

// Auth is off for now, as on every execution-service route. The comment on each
// route is the action from src/config/permissions.js it should check once auth lands.
router.get("/permissions", getBlockProfilePermissions);
router.get("/districts", getDistricts); // viewBlockProfile
router.get("/", getBlockProfiles); // viewBlockProfile
router.post("/", createBlockProfile); // createBlockProfile
router.get("/:id", getBlockProfileById); // viewBlockProfile
router.put("/:id", updateBlockProfile); // editBlockProfile
router.delete("/:id", deleteBlockProfile); // deleteBlockProfile
router.post("/:id/kml", addKmlFile); // manageKml
router.delete("/:id/kml/:fileId", removeKmlFile); // manageKml

// Block and GP infra
router.get("/:id/map", getBlockMap); // viewExecution
router.get("/:id/infra", getBlockInfra); // viewExecution
router.put("/:id/infra", saveBlockInfra); // captureInfra
router.get("/:id/gp-infra", getGpInfraList); // viewExecution
router.get("/:id/gps/:lgdCode/infra", getGpInfra); // viewExecution
router.put("/:id/gps/:lgdCode/infra", saveGpInfra); // captureInfra

// Block and GP equipment sheets (web), with their geo photos (mobile app)
router.put("/:id/equipment/:form/geo-photo", saveBlockEquipmentPhoto); // captureInfra   form: block | misc
router.put("/:id/gps/:lgdCode/equipment/:form/geo-photo", saveGpEquipmentPhoto); // captureInfra   form: gp | misc
// One photo per type of misc equipment (RACK, FDMS, FTB, CCU, SPV)
router.put("/:id/equipment/misc/items/:type/geo-photo", saveBlockMiscItemPhoto); // captureInfra
router.put("/:id/gps/:lgdCode/equipment/misc/items/:type/geo-photo", saveGpMiscItemPhoto); // captureInfra
router.get("/:id/equipment/:form?", getBlockEquipment); // viewExecution   form: block (default) | misc
router.put("/:id/equipment/:form?", saveBlockEquipment); // manageInfraEquipment
router.get("/:id/gps/:lgdCode/equipment/:form", getGpEquipment); // viewExecution
router.put("/:id/gps/:lgdCode/equipment/:form", saveGpEquipment); // manageInfraEquipment

export default router;

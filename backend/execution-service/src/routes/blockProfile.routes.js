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
  updateBlockTeam,
  freezeBlockProfile,
} from "../controller/blockProfile.controller.js";
import { guardBlock, requireAction } from "../services/access.service.js";
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

import { createPitMerge, getPitGaps, undoPitMergeRoute } from "../controller/pitMerge.controller.js";

const router = Router();

// Every route needs a signed-in user (requireAuth in server.js). Each one checks the action
// from src/config/permissions.js on the block's team; `write` routes also refuse frozen blocks.
const view = guardBlock("viewBlockProfile");
const viewExecution = guardBlock("viewExecution");
const write = (action) => guardBlock(action, { write: true });

router.get("/permissions", getBlockProfilePermissions);
router.get("/districts", requireAction("viewBlockProfile"), getDistricts);
router.get("/", requireAction("viewBlockProfile"), getBlockProfiles);
router.post("/", requireAction("createBlockProfile"), createBlockProfile);
router.get("/:id", view, getBlockProfileById);
router.put("/:id", write("editBlockProfile"), updateBlockProfile);
router.delete("/:id", write("deleteBlockProfile"), deleteBlockProfile);
router.put("/:id/team", write("manageTeam"), updateBlockTeam);
router.post("/:id/freeze", guardBlock("freezeBlock"), freezeBlockProfile);
router.get("/:id/pit-gaps", viewExecution, getPitGaps);
router.post("/:id/pit-merges", write("mergePits"), createPitMerge);
router.post("/:id/pit-merges/:mergeId/undo", write("mergePits"), undoPitMergeRoute);
router.post("/:id/kml", write("manageKml"), addKmlFile);
router.delete("/:id/kml/:fileId", write("manageKml"), removeKmlFile);

// Block and GP infra
router.get("/:id/map", viewExecution, getBlockMap);
router.get("/:id/infra", viewExecution, getBlockInfra);
router.put("/:id/infra", write("captureInfra"), saveBlockInfra);
router.get("/:id/gp-infra", viewExecution, getGpInfraList);
router.get("/:id/gps/:lgdCode/infra", viewExecution, getGpInfra);
router.put("/:id/gps/:lgdCode/infra", write("captureInfra"), saveGpInfra);

// Block and GP equipment sheets (web), with their geo photos (mobile app)
router.put("/:id/equipment/:form/geo-photo", write("captureInfra"), saveBlockEquipmentPhoto); // form: block | misc
router.put("/:id/gps/:lgdCode/equipment/:form/geo-photo", write("captureInfra"), saveGpEquipmentPhoto); // form: gp | misc
// One photo per type of misc equipment (RACK, FDMS, FTB, CCU, SPV)
router.put("/:id/equipment/misc/items/:type/geo-photo", write("captureInfra"), saveBlockMiscItemPhoto);
router.put("/:id/gps/:lgdCode/equipment/misc/items/:type/geo-photo", write("captureInfra"), saveGpMiscItemPhoto);
router.get("/:id/equipment/:form?", viewExecution, getBlockEquipment); // form: block (default) | misc
router.put("/:id/equipment/:form?", write("manageInfraEquipment"), saveBlockEquipment);
router.get("/:id/gps/:lgdCode/equipment/:form", viewExecution, getGpEquipment);
router.put("/:id/gps/:lgdCode/equipment/:form", write("manageInfraEquipment"), saveGpEquipment);

export default router;

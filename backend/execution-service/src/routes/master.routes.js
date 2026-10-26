import { Router } from "express";
import { createProfilesFromMaster, getMasterBlock, getMasterBlocks, getMasterDistricts } from "../controller/master.controller.js";
import { requireAction } from "../services/access.service.js";

// The LGD master (read only here; loaded by scripts/importLgdMaster.js)
const router = Router();

router.get("/districts", requireAction("viewBlockProfile"), getMasterDistricts);
router.get("/blocks", requireAction("viewBlockProfile"), getMasterBlocks);
router.post("/blocks/create-profiles", requireAction("bulkCreateBlockProfiles"), createProfilesFromMaster);
router.get("/blocks/:blockCode", requireAction("viewBlockProfile"), getMasterBlock);

export default router;

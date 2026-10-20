import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import { normalizeRole } from "../config/permissions.js";

// The demo block and everything under it is shown to ADMIN only. Until auth lands the
// role comes from the X-User-Role header (readActor), like everything else here.

export const seesDemo = (req) => normalizeRole(req.actor?.role) === "ADMIN";

// Mongo filter for BlockProfile queries
export const demoBlockFilter = (req) => (seesDemo(req) ? {} : { isDemo: { $ne: true } });

// Section ids of demo blocks, for leaving their work out of lists (empty for ADMIN)
export const hiddenDemoSectionIds = async (req) => {
  if (seesDemo(req)) return [];
  const blocks = await BlockProfile.find({ isDemo: true }).select("_id").lean();
  if (!blocks.length) return [];
  return Section.find({ blockProfile: { $in: blocks.map((b) => b._id) } }).distinct("_id");
};

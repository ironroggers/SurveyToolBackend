import BlockProfile from "../models/blockProfile.model.js";
import { blockFilter } from "../services/access.service.js";
import { notFound, sendError } from "../utils/httpError.js";
import { pointOf } from "../utils/geo.js";
import { buildBlockMap } from "./blockMap.controller.js";

// Master map: every block on one read-only map. The list is small (one row per block,
// for the State → District → Block filter); a block's layers load only once it's picked.
// Every status is included; the demo block stays ADMIN only, as everywhere else.

// GET /api/master-map/blocks   (viewExecution)
export const getMasterMapBlocks = async (req, res) => {
  try {
    const profiles = await BlockProfile.find(blockFilter(req, "viewExecution"))
      .select("state district block blockCode blockRouter gps.latitude gps.longitude")
      .sort({ state: 1, district: 1, block: 1 })
      .lean();
    const items = profiles.map((p) => ({
      _id: String(p._id),
      state: p.state || "",
      district: p.district || "",
      block: p.block,
      blockCode: p.blockCode,
      gpCount: p.gps?.length || 0,
      // Where to look for the block before its layers load
      center: pointOf(p.blockRouter) || (p.gps || []).map(pointOf).find(Boolean) || null,
    }));
    res.json({ items });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/master-map/blocks/:id   (viewExecution)
// The block's network (block router and GPs), KML files and everything the block map draws
export const getMasterMapBlock = async (req, res) => {
  try {
    const profile = await BlockProfile.findById(req.params.id)
      .select("state district block blockCode gps blockRouter kmlFiles isDemo")
      .lean();
    // Access was checked by the route's guard
    if (!profile) throw notFound("Block profile not found");
    const layers = await buildBlockMap(profile);
    res.json({
      profile: {
        _id: String(profile._id),
        state: profile.state,
        district: profile.district,
        block: profile.block,
        blockCode: profile.blockCode,
        gps: profile.gps || [],
        blockRouter: profile.blockRouter,
        kmlFiles: (profile.kmlFiles || []).map((f) => ({ _id: String(f._id), name: f.name, url: f.url, sizeBytes: f.sizeBytes, uploadedAt: f.uploadedAt })),
      },
      ...layers,
    });
  } catch (error) {
    sendError(res, error);
  }
};

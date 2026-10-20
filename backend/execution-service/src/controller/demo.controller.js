import BlockProfile from "../models/blockProfile.model.js";
import { HttpError, sendError } from "../utils/httpError.js";
import { seesDemo } from "../demo/demoAccess.js";
import { resetDemoBlock } from "../demo/demoBlock.js";

const adminOnly = (req) => {
  if (!seesDemo(req)) throw new HttpError(403, "The demo block is available to admins only");
};

// The demo files' base URL as the caller reached this service
const baseUrlOf = (req) => `${req.get("X-Forwarded-Proto") || req.protocol}://${req.get("X-Forwarded-Host") || req.get("host")}`;

// GET /api/demo/block   (ADMIN)
export const getDemoBlock = async (req, res) => {
  try {
    adminOnly(req);
    const block = await BlockProfile.findOne({ isDemo: true }).select("block updatedAt").lean();
    res.json({ block: block ? { _id: block._id, block: block.block, updatedAt: block.updatedAt } : null });
  } catch (error) {
    sendError(res, error);
  }
};

let resetting = null;

// POST /api/demo/block/reset   (ADMIN) — builds the demo block from scratch (also the first time)
export const resetDemo = async (req, res) => {
  try {
    adminOnly(req);
    // One reset at a time; a second click waits for the same result
    resetting ||= resetDemoBlock({ baseUrl: baseUrlOf(req) }).finally(() => {
      resetting = null;
    });
    res.json(await resetting);
  } catch (error) {
    sendError(res, error);
  }
};

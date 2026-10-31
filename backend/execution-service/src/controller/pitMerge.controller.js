import { sendError } from "../utils/httpError.js";
import { findPitGaps, mergePits, undoPitMerge } from "../services/pitMerge.service.js";

// GET /api/block-profiles/:id/pit-gaps?subSection=   (viewExecution)
export const getPitGaps = async (req, res) => {
  try {
    res.json(await findPitGaps(req.access.profile, req.query.subSection));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/block-profiles/:id/pit-merges   (mergePits)
// { pits: [{ subSection, side }], keep: { subSection, side } }
export const createPitMerge = async (req, res) => {
  try {
    res.status(201).json(await mergePits(req, req.access.profile, req.body?.pits, req.body?.keep));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/block-profiles/:id/pit-merges/:mergeId/undo   (mergePits)
export const undoPitMergeRoute = async (req, res) => {
  try {
    res.json(await undoPitMerge(req, req.access.profile, req.params.mergeId, req.body?.reason));
  } catch (error) {
    sendError(res, error);
  }
};

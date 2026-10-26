import LgdBlock from "../models/lgdBlock.model.js";
import BlockProfile from "../models/blockProfile.model.js";
import { badRequest, notFound, sendError } from "../utils/httpError.js";

// The LGD master (models/lgdBlock.model.js): pick a block and its state, district and GPs fill
// in a block profile, or Admin creates profiles for many blocks at once.

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Block code -> id of the block profile made for it, if any (including inactive ones)
const profileIds = async (codes) => {
  const profiles = await BlockProfile.find({ blockCode: { $in: codes } }).select("blockCode").lean();
  return new Map(profiles.map((p) => [p.blockCode, String(p._id)]));
};

const summary = (b, ids) => ({
  state: b.state,
  stateCode: b.stateCode,
  district: b.district,
  districtCode: b.districtCode,
  block: b.block,
  blockCode: b.blockCode,
  gpCount: b.gps?.length || 0,
  blockProfileId: ids.get(b.blockCode) || null,
});

// GET /api/master/districts   (viewBlockProfile)
export const getMasterDistricts = async (req, res) => {
  try {
    const rows = await LgdBlock.aggregate([
      { $group: { _id: "$districtCode", district: { $first: "$district" }, state: { $first: "$state" }, stateCode: { $first: "$stateCode" }, blocks: { $sum: 1 } } },
      { $sort: { district: 1 } },
    ]);
    res.json({ items: rows.map(({ _id, ...r }) => ({ districtCode: _id, ...r })) });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/master/blocks?districtCode=&q=   (viewBlockProfile)
export const getMasterBlocks = async (req, res) => {
  try {
    const { districtCode, q } = req.query;
    const filter = {};
    if (districtCode) filter.districtCode = String(districtCode);
    if (q) filter.$or = [{ block: { $regex: escapeRegex(q), $options: "i" } }, { blockCode: { $regex: escapeRegex(q), $options: "i" } }];
    const blocks = await LgdBlock.find(filter).sort({ district: 1, block: 1 }).lean();
    const ids = await profileIds(blocks.map((b) => b.blockCode));
    res.json({ items: blocks.map((b) => summary(b, ids)) });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/master/blocks/:blockCode   (viewBlockProfile) — with its GPs
export const getMasterBlock = async (req, res) => {
  try {
    const block = await LgdBlock.findOne({ blockCode: req.params.blockCode }).lean();
    if (!block) throw notFound("Block not found in the master");
    const ids = await profileIds([block.blockCode]);
    res.json({ ...summary(block, ids), gps: block.gps.map((g) => ({ name: g.name, lgdCode: g.lgdCode })) });
  } catch (error) {
    sendError(res, error);
  }
};

const MAX_BULK = 500;

// POST /api/master/blocks/create-profiles   { blockCodes: [] }   (bulkCreateBlockProfiles)
// One block profile per block with its names, codes and GPs; the rest (router, rings,
// team) is filled in later. Blocks that already have a profile are skipped.
export const createProfilesFromMaster = async (req, res) => {
  try {
    const codes = [...new Set((Array.isArray(req.body?.blockCodes) ? req.body.blockCodes : []).map(String))];
    if (!codes.length) throw badRequest("Pick the blocks to create", { blockCodes: "Pick at least one block" });
    if (codes.length > MAX_BULK) throw badRequest(`Pick at most ${MAX_BULK} blocks at a time`);

    const [blocks, ids] = await Promise.all([LgdBlock.find({ blockCode: { $in: codes } }).lean(), profileIds(codes)]);
    const byCode = new Map(blocks.map((b) => [b.blockCode, b]));
    const created = [];
    const skipped = [];
    for (const code of codes) {
      const b = byCode.get(code);
      if (!b) {
        skipped.push({ blockCode: code, reason: "Not in the master" });
        continue;
      }
      if (ids.has(code)) {
        skipped.push({ blockCode: code, block: b.block, reason: "Already has a block profile" });
        continue;
      }
      if (!b.gps.length) {
        skipped.push({ blockCode: code, block: b.block, reason: "No GPs in the master" });
        continue;
      }
      try {
        const profile = await BlockProfile.create({
          state: b.state,
          stateCode: b.stateCode,
          district: b.district,
          districtCode: b.districtCode,
          block: b.block,
          blockCode: b.blockCode,
          numberOfGps: b.gps.length,
          gps: b.gps.map((g) => ({ name: g.name, lgdCode: g.lgdCode })),
          createdBy: req.actor.id,
          updatedBy: req.actor.id,
        });
        created.push({ blockCode: code, block: b.block, _id: String(profile._id) });
      } catch (error) {
        // Someone created it in the meantime, or the master has a code the profile refuses
        skipped.push({ blockCode: code, block: b.block, reason: error.code === 11000 ? "Already has a block profile" : error.message });
      }
    }
    res.status(created.length ? 201 : 200).json({ created, skipped });
  } catch (error) {
    sendError(res, error);
  }
};

import BlockProfile, { GEOGRAPHY_FIELDS, MAX_RINGS, ringCodes } from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import { PERMISSIONS, normalizeRole, permissionsForRole } from "../config/permissions.js";
import { deleteS3Object } from "../utils/s3.js";
import { findBlockNode, formatLatLong } from "../utils/blockNodes.js";
import { blockProgress } from "../services/progress.service.js";
import { demoBlockFilter, seesDemo } from "../demo/demoAccess.js";

// Fields clients may set on create/update. KML files have their own routes.
const EDITABLE_FIELDS = [
  "state",
  "stateCode",
  "district",
  "districtCode",
  "districtCensusCode",
  "block",
  "blockCode",
  "numberOfGps",
  "gps",
  "numberOfRacks",
  "remarks",
  "blockRouter",
  "status",
];

const pick = (source, keys) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));

// Forms send "" for an unselected site type; the enum only accepts a value or nothing.
// Rings come from numberOfRings: their codes are generated (A01, A02, …), never typed.
const editableFields = (body) => {
  const fields = pick(body, EDITABLE_FIELDS);
  if (body?.numberOfRings !== undefined && body.numberOfRings !== null && body.numberOfRings !== "") {
    const count = Number(body.numberOfRings);
    if (!Number.isInteger(count) || count < 0 || count > MAX_RINGS) {
      const error = new Error(`Number of rings must be a whole number up to ${MAX_RINGS}`);
      error.name = "ValidationError";
      error.errors = { numberOfRings: { message: error.message } };
      throw error;
    }
    fields.rings = ringCodes(count).map((code) => ({ code }));
  } else if (body?.numberOfRings === "" || body?.numberOfRings === null) {
    fields.rings = [];
  }
  if (fields.blockRouter?.siteType === "") fields.blockRouter = { ...fields.blockRouter, siteType: null };
  return fields;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sendError = (res, error) => {
  if (error.code === 11000) {
    const code = error.keyValue?.blockCode;
    return res.status(409).json({ message: `A block profile with LGD code ${code} already exists` });
  }
  if (error.name === "ValidationError") {
    // Per-field messages so forms can point at the offending input
    const errors = Object.fromEntries(Object.entries(error.errors).map(([path, err]) => [path, err.message]));
    return res.status(400).json({ message: Object.values(errors).join("; "), errors });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${error.path}: ${error.value}` });
  }
  return res.status(500).json({ message: error.message });
};

// Section count and total length per block profile id
const sectionStats = async (ids) => {
  if (ids.length === 0) return new Map();
  const rows = await Section.aggregate([
    { $match: { blockProfile: { $in: ids } } },
    { $group: { _id: "$blockProfile", sectionCount: { $sum: 1 }, sectionLength: { $sum: "$sectionLength" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
};

// `progress` is the execution progress behind the Blocks list's three marks
const withStats = (profile, stats, progress) => {
  const row = stats.get(String(profile._id));
  return {
    ...profile.toJSON(),
    sectionCount: row?.sectionCount || 0,
    sectionLength: row?.sectionLength || 0,
    progress: progress?.get(String(profile._id)),
  };
};

// Sections copy their end nodes' names and coordinates, so refresh them after the
// block's router, GPs or code change. A node that was removed from the block keeps its last copy.
const syncSectionEnds = async (profile) => {
  const sections = await Section.find({ blockProfile: profile._id, fromNode: { $exists: true } }).lean();
  const operations = sections.flatMap((section) => {
    const set = {};
    for (const [key, latLongKey] of [["fromNode", "fromLatLong"], ["toNode", "toLatLong"]]) {
      const node = findBlockNode(profile, section[key]);
      if (!node) continue;
      set[`${key}.code`] = node.code;
      set[`${key}.name`] = node.name;
      set[latLongKey] = formatLatLong(node);
    }
    return Object.keys(set).length ? [{ updateOne: { filter: { _id: section._id }, update: { $set: set } } }] : [];
  });
  if (operations.length) await Section.bulkWrite(operations);
};

const respondWithProfile = async (res, profile, status = 200) => {
  const [stats, progress] = await Promise.all([sectionStats([profile._id]), blockProgress([profile])]);
  res.status(status).json(withStats(profile, stats, progress));
};

export const getBlockProfilePermissions = (req, res) => {
  const { role } = req.query;
  if (role) {
    return res.json({ role: normalizeRole(role), actions: permissionsForRole(role) });
  }
  res.json({ matrix: PERMISSIONS });
};

export const getBlockProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, status, district } = req.query;
    const filter = { ...demoBlockFilter(req) };
    // Deactivated profiles stay hidden unless asked for; status=ALL returns everything
    if (!status) filter.status = { $ne: "INACTIVE" };
    else if (status !== "ALL") filter.status = status;
    if (district && district !== "ALL") filter.district = district;
    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [
        { block: pattern },
        { district: pattern },
        { blockCode: pattern },
        { "gps.name": pattern },
        { "gps.lgdCode": pattern },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [profiles, total] = await Promise.all([
      BlockProfile.find(filter).sort({ district: 1, block: 1 }).skip(skip).limit(Number(limit)),
      BlockProfile.countDocuments(filter),
    ]);
    const [stats, progress] = await Promise.all([sectionStats(profiles.map((profile) => profile._id)), blockProgress(profiles)]);
    res.json({
      items: profiles.map((profile) => withStats(profile, stats, progress)),
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/block-profiles/districts — for the Blocks list's district filter
export const getDistricts = async (req, res) => {
  try {
    const districts = await BlockProfile.distinct("district", { status: { $ne: "INACTIVE" }, ...demoBlockFilter(req) });
    res.json({ items: districts.filter(Boolean).sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    sendError(res, error);
  }
};

export const getBlockProfileById = async (req, res) => {
  try {
    const profile = await BlockProfile.findById(req.params.id);
    if (!profile || (profile.isDemo && !seesDemo(req))) return res.status(404).json({ message: "Block profile not found" });
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

export const createBlockProfile = async (req, res) => {
  try {
    // createdBy comes from the client until auth lands; then it will be req.user.id
    const { createdBy } = req.body || {};
    const profile = await BlockProfile.create({
      ...editableFields(req.body),
      createdBy,
      updatedBy: createdBy,
    });
    await respondWithProfile(res, profile, 201);
  } catch (error) {
    sendError(res, error);
  }
};

export const updateBlockProfile = async (req, res) => {
  try {
    const profile = await BlockProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Block profile not found" });

    const updates = editableFields(req.body);
    const geographyChanged = GEOGRAPHY_FIELDS.some(
      (field) => field in updates && String(updates[field] ?? "") !== String(profile[field] ?? "")
    );
    profile.set(updates);
    if (req.body.updatedBy) profile.updatedBy = req.body.updatedBy;
    await profile.save();

    // Sections keep a copy of the block's names and codes, so refresh them
    if (geographyChanged) {
      const geography = Object.fromEntries(GEOGRAPHY_FIELDS.map((field) => [field, profile[field] ?? ""]));
      await Section.updateMany({ blockProfile: profile._id }, { $set: geography });
    }
    if ("blockRouter" in updates || "gps" in updates || "blockCode" in updates) await syncSectionEnds(profile);
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

// Soft delete: the profile is set INACTIVE and keeps its sections
export const deleteBlockProfile = async (req, res) => {
  try {
    const profile = await BlockProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Block profile not found" });

    // Only ADMIN may deactivate (and so force). With auth off, the clients enforce that.
    const sectionCount = await Section.countDocuments({ blockProfile: profile._id });
    if (sectionCount > 0 && req.query.force !== "true") {
      return res.status(409).json({
        message: `This block has ${sectionCount} ${sectionCount === 1 ? "section" : "sections"}. Deactivate it with force=true.`,
        sectionCount,
      });
    }

    profile.status = "INACTIVE";
    if (req.query.updatedBy) profile.updatedBy = req.query.updatedBy;
    await profile.save({ validateModifiedOnly: true });
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

// The file itself is uploaded to S3 through POST /api/uploads/presign first
export const addKmlFile = async (req, res) => {
  try {
    const { name, url, s3Key, sizeBytes, uploadedBy } = req.body || {};
    if (!/^https?:\/\//i.test(url || "")) {
      return res.status(400).json({ message: "A KML file URL (http or https) is required" });
    }
    const profile = await BlockProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Block profile not found" });

    profile.kmlFiles.push({ name, url, s3Key, sizeBytes, uploadedBy, uploadedAt: new Date() });
    await profile.save({ validateModifiedOnly: true });
    await respondWithProfile(res, profile, 201);
  } catch (error) {
    sendError(res, error);
  }
};

export const removeKmlFile = async (req, res) => {
  try {
    const profile = await BlockProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Block profile not found" });
    const file = profile.kmlFiles.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: "KML file not found" });

    profile.kmlFiles.pull(file._id);
    await profile.save({ validateModifiedOnly: true });

    // Best effort: the record is already gone, so a failed delete only leaves an orphaned object
    deleteS3Object(file.s3Key).catch((error) => console.error("[block-profiles] S3 delete failed:", file.s3Key, error.message));
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

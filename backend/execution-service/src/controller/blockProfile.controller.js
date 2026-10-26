import BlockProfile, { GEOGRAPHY_FIELDS, MAX_RINGS, ringCodes } from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import mongoose from "mongoose";
import { PERMISSIONS, TEAM_ROLES, normalizeRole, permissionsForRole } from "../config/permissions.js";
import { deleteS3Object } from "../utils/s3.js";
import { findBlockNode, formatLatLong } from "../utils/blockNodes.js";
import { blockProgress } from "../services/progress.service.js";
import { actorRole, blockFilter, isAdmin } from "../services/access.service.js";
import { actorOf } from "../services/execution.service.js";
import { HttpError } from "../utils/httpError.js";

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
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message, code: error.code, errors: error.errors });
  }
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
    const filter = blockFilter(req, "viewBlockProfile");
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
    const districts = await BlockProfile.distinct("district", { status: { $ne: "INACTIVE" }, ...blockFilter(req, "viewBlockProfile") });
    res.json({ items: districts.filter(Boolean).sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    sendError(res, error);
  }
};

// The route's guard has loaded and checked the profile (req.access)
export const getBlockProfileById = async (req, res) => {
  try {
    await respondWithProfile(res, req.access.profile);
  } catch (error) {
    sendError(res, error);
  }
};

export const createBlockProfile = async (req, res) => {
  try {
    const createdBy = req.actor.id;
    // A Zonal Manager who creates a block is on its team, so they can go on working on it
    const team = actorRole(req) === "ZONAL MANAGER" && createdBy ? [{ userId: createdBy, name: req.actor.name, role: "ZONAL MANAGER" }] : [];
    const profile = await BlockProfile.create({
      ...editableFields(req.body),
      team,
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
    const { profile } = req.access;
    const updates = editableFields(req.body);
    const geographyChanged = GEOGRAPHY_FIELDS.some(
      (field) => field in updates && String(updates[field] ?? "") !== String(profile[field] ?? "")
    );
    profile.set(updates);
    profile.updatedBy = req.actor.id;
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
    const { profile } = req.access;
    const sectionCount = await Section.countDocuments({ blockProfile: profile._id });
    if (sectionCount > 0 && req.query.force !== "true") {
      return res.status(409).json({
        message: `This block has ${sectionCount} ${sectionCount === 1 ? "section" : "sections"}. Deactivate it with force=true.`,
        sectionCount,
      });
    }

    profile.status = "INACTIVE";
    profile.updatedBy = req.actor.id;
    await profile.save({ validateModifiedOnly: true });
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

// The file itself is uploaded to S3 through POST /api/uploads/presign first
export const addKmlFile = async (req, res) => {
  try {
    const { name, url, s3Key, sizeBytes } = req.body || {};
    if (!/^https?:\/\//i.test(url || "")) {
      return res.status(400).json({ message: "A KML file URL (http or https) is required" });
    }
    const { profile } = req.access;
    profile.kmlFiles.push({ name, url, s3Key, sizeBytes, uploadedBy: req.actor.id, uploadedAt: new Date() });
    await profile.save({ validateModifiedOnly: true });
    await respondWithProfile(res, profile, 201);
  } catch (error) {
    sendError(res, error);
  }
};

export const removeKmlFile = async (req, res) => {
  try {
    const { profile } = req.access;
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

const teamKey = (m) => `${m.role}:${m.userId}`;

// The team as sent: [{ userId, name, role }], each user once per role
const cleanTeam = (input) => {
  if (!Array.isArray(input)) throw new HttpError(400, "Send the team as a list", { errors: { team: "Send the team as a list" } });
  const seen = new Map();
  input.forEach((m, index) => {
    const role = normalizeRole(m?.role);
    const userId = String(m?.userId || "");
    if (!TEAM_ROLES.includes(role)) {
      throw new HttpError(400, `Team role must be one of ${TEAM_ROLES.join(", ")}`, { errors: { [`team.${index}.role`]: "Pick a role" } });
    }
    if (!mongoose.isValidObjectId(userId)) {
      throw new HttpError(400, "Pick a user", { errors: { [`team.${index}.userId`]: "Pick a user" } });
    }
    const member = { userId, name: String(m?.name || "").trim() || undefined, role };
    seen.set(teamKey(member), member);
  });
  return [...seen.values()];
};

// PUT /api/block-profiles/:id/team   (manageTeam)
// Admin sets the whole team; a Zonal Manager sets everyone but the Zonal Managers.
export const updateBlockTeam = async (req, res) => {
  try {
    const { profile } = req.access;
    const team = cleanTeam(req.body?.team);
    if (!isAdmin(req)) {
      const zonal = (list) => list.filter((m) => m.role === "ZONAL MANAGER").map(teamKey).sort().join(",");
      if (zonal(team) !== zonal(profile.team.map((m) => ({ userId: String(m.userId), role: m.role })))) {
        throw new HttpError(403, "Only Admin can change the Zonal Managers", { code: "FORBIDDEN" });
      }
    }
    profile.team = team;
    profile.updatedBy = req.actor.id;
    await profile.save({ validateModifiedOnly: true });
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/block-profiles/:id/freeze   (freezeBlock)
// From then on only Admin can change anything in the block
export const freezeBlockProfile = async (req, res) => {
  try {
    const { profile } = req.access;
    if (profile.frozen?.at) throw new HttpError(409, "This block is already frozen", { code: "FROZEN" });
    profile.frozen = { at: new Date(), by: actorOf(req) };
    profile.updatedBy = req.actor.id;
    await profile.save({ validateModifiedOnly: true });
    await respondWithProfile(res, profile);
  } catch (error) {
    sendError(res, error);
  }
};

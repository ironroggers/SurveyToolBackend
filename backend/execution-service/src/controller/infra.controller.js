import BlockProfile from "../models/blockProfile.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import { MEDIA_RULES } from "../config/executionTypes.js";
import { conflict, failIfErrors, notFound, sendError } from "../utils/httpError.js";
import { distanceM, pointOf, round } from "../utils/geo.js";
import { actorOf, checkVersion, cleanFix, cleanMedia } from "../services/execution.service.js";
import { queueStampsFor } from "../services/stampQueue.service.js";
import { ROUTER_NAME } from "../utils/blockNodes.js";

// Block router and GP infra: a GPS location and 1–4 photos, each with an optional description.
// Editable after saving.

const loadProfile = async (id) => {
  const profile = await BlockProfile.findById(id).select("block blockCode district blockRouter gps");
  if (!profile) throw notFound("Block profile not found");
  return profile;
};

const findGp = (profile, lgdCode) => {
  const gp = (profile.gps || []).find((g) => g.lgdCode === lgdCode);
  if (!gp) throw notFound("GP not found in this block");
  return gp;
};

// The block-level capture is at the block router
const routerTarget = (profile) => ({ name: ROUTER_NAME, code: profile.blockCode, latitude: profile.blockRouter?.latitude, longitude: profile.blockRouter?.longitude });

const target = (place, code) => ({
  name: place?.name,
  code,
  latitude: place?.latitude,
  longitude: place?.longitude,
});

const buildCapture = (req) => {
  const body = req.body || {};
  const errors = {};
  const rule = MEDIA_RULES.infra;
  const fix = cleanFix(body, "location", errors, "Capture the location");
  const photosIn = Array.isArray(body.photos) ? body.photos.filter((p) => p?.media) : [];
  if (photosIn.length < rule.minPhotos) errors.photos = "Take at least one photo";
  if (photosIn.length > rule.maxPhotos) errors.photos = `Up to ${rule.maxPhotos} photos`;
  const photos = photosIn
    .slice(0, rule.maxPhotos)
    .map((p, i) => {
      const media = cleanMedia(p.media, `photos.${i}.media`, "IMAGE", errors);
      return media ? { media, description: String(p.description || "").trim() || undefined } : null;
    })
    .filter(Boolean);
  failIfErrors(errors);
  return { ...fix, photos };
};

const save = async (req, filter) => {
  const values = buildCapture(req);
  const existing = await InfraCapture.findOne(filter);
  if (existing) {
    checkVersion(existing, req.body?.version);
    existing.set({ ...values, updatedBy: actorOf(req) });
    const saved = await existing.save();
    queueStampsFor(saved);
    return saved;
  }
  try {
    const created = await InfraCapture.create({ ...filter, ...values, capturedBy: actorOf(req), updatedBy: actorOf(req) });
    queueStampsFor(created);
    return created;
  } catch (error) {
    // Someone else saved the first capture at the same moment
    if (error.code === 11000) throw conflict("This was updated on another device", "STALE");
    throw error;
  }
};

// GET /api/block-profiles/:id/infra   (viewExecution)
export const getBlockInfra = async (req, res) => {
  try {
    const profile = await loadProfile(req.params.id);
    const capture = await InfraCapture.findOne({ blockProfile: profile._id, level: "BLOCK" });
    res.json({ target: routerTarget(profile), capture });
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/block-profiles/:id/infra   (captureInfra)
export const saveBlockInfra = async (req, res) => {
  try {
    const profile = await loadProfile(req.params.id);
    const capture = await save(req, { blockProfile: profile._id, level: "BLOCK", gpLgdCode: null });
    res.json({ target: routerTarget(profile), capture });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/block-profiles/:id/gp-infra   (viewExecution)
// Every GP with its capture state and which equipment sheets are filled, nearest to the block router first
export const getGpInfraList = async (req, res) => {
  try {
    const profile = await loadProfile(req.params.id);
    const [captures, equipment] = await Promise.all([
      InfraCapture.find({ blockProfile: profile._id, level: "GP" }).select("gpLgdCode photos updatedAt"),
      InfraEquipment.find({ blockProfile: profile._id, gpLgdCode: { $ne: null }, assetCode: { $nin: [null, ""] } }).select("gpLgdCode form").lean(),
    ]);
    const byCode = new Map(captures.map((c) => [c.gpLgdCode, c]));
    const filled = new Set(equipment.map((e) => `${e.form}:${e.gpLgdCode}`));
    const router = pointOf(profile.blockRouter);
    const items = (profile.gps || []).map((gp) => {
      const point = pointOf(gp);
      const capture = byCode.get(gp.lgdCode);
      return {
        name: gp.name,
        lgdCode: gp.lgdCode,
        latitude: gp.latitude,
        longitude: gp.longitude,
        distanceFromRouterM: router && point ? round(distanceM(router, point), 0) : null,
        captured: Boolean(capture),
        photoCount: capture?.photos.length || 0,
        savedAt: capture?.updatedAt,
        gpEquipment: filled.has(`gp:${gp.lgdCode}`),
        miscEquipment: filled.has(`misc:${gp.lgdCode}`),
      };
    });
    // GPs without coordinates go last
    items.sort((a, b) => (a.distanceFromRouterM ?? Infinity) - (b.distanceFromRouterM ?? Infinity) || a.name.localeCompare(b.name));
    res.json({ items, captured: items.filter((i) => i.captured).length, total: items.length });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/block-profiles/:id/gps/:lgdCode/infra   (viewExecution)
export const getGpInfra = async (req, res) => {
  try {
    const profile = await loadProfile(req.params.id);
    const gp = findGp(profile, req.params.lgdCode);
    const capture = await InfraCapture.findOne({ blockProfile: profile._id, level: "GP", gpLgdCode: gp.lgdCode });
    res.json({ target: target(gp, gp.lgdCode), capture });
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/block-profiles/:id/gps/:lgdCode/infra   (captureInfra)
export const saveGpInfra = async (req, res) => {
  try {
    const profile = await loadProfile(req.params.id);
    const gp = findGp(profile, req.params.lgdCode);
    const capture = await save(req, { blockProfile: profile._id, level: "GP", gpLgdCode: gp.lgdCode });
    res.json({ target: target(gp, gp.lgdCode), capture });
  } catch (error) {
    sendError(res, error);
  }
};

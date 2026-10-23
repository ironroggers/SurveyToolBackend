import { isIP } from "node:net";
import BlockProfile from "../models/blockProfile.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import { EQUIPMENT_FORMS } from "../config/infraEquipment.js";
import { conflict, failIfErrors, notFound, sendError } from "../utils/httpError.js";
import { pointOf } from "../utils/geo.js";
import { actorOf, checkVersion, cleanMedia } from "../services/execution.service.js";
import { queueStampsFor } from "../services/stampQueue.service.js";

// Equipment sheets (src/config/infraEquipment.js), filled on the web after the block
// exists: block once per block, gp once per GP, misc once per block and once per GP.

const loadProfile = async (id) => {
  const profile = await BlockProfile.findById(id).select(
    "state stateCode district districtCensusCode block blockCode siteType bhq gps blockRouter"
  );
  if (!profile) throw notFound("Block profile not found");
  return profile;
};

const findGp = (profile, lgdCode) => {
  const gp = (profile.gps || []).find((g) => g.lgdCode === lgdCode);
  if (!gp) throw notFound("GP not found in this block");
  return gp;
};

const formOf = (key, level) => {
  const form = EQUIPMENT_FORMS[key];
  if (!form || !form.levels.includes(level)) throw notFound("Unknown equipment form");
  return form;
};

const MAC_HEX = /^[0-9A-F]{12}$/;

// "aa-bb-cc-dd-ee-ff", "aabb.ccdd.eeff" or "aabbccddeeff" -> "AA:BB:CC:DD:EE:FF"
const cleanMac = (value) => {
  const hex = value.toUpperCase().replace(/[:.\-\s]/g, "");
  return MAC_HEX.test(hex) ? hex.match(/../g).join(":") : null;
};

const cleanValue = (field, raw) => {
  const text = String(raw ?? "").trim();
  if (!text) return { value: undefined };
  switch (field.type) {
    case "int": {
      const n = Number(text);
      return Number.isInteger(n) && n >= 0 ? { value: n } : { error: "Enter a whole number" };
    }
    case "metres": {
      const n = Number(text);
      return Number.isFinite(n) && n >= 0 ? { value: n } : { error: "Enter the length in metres" };
    }
    case "enum":
      return field.options.includes(text) ? { value: text } : { error: "Pick from the list" };
    case "ip":
      return isIP(text) ? { value: text } : { error: "Enter a valid IP address" };
    case "mac": {
      const mac = cleanMac(text);
      return mac ? { value: mac } : { error: "Enter a MAC like AA:BB:CC:DD:EE:FF" };
    }
    default:
      return { value: text };
  }
};

const buildValues = (form, body = {}) => {
  const errors = {};
  const values = {};
  for (const [key, field] of Object.entries(form.fields)) {
    const { value, error } = cleanValue(field, body[key]);
    if (error) errors[key] = error;
    else if (value === undefined && field.required) errors[key] = "Required";
    values[key] = value;
  }
  if (values.assetCode) {
    values.assetCode = values.assetCode.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9.]+$/.test(values.assetCode)) errors.assetCode = "Letters, digits and dots only";
  }
  const point = pointOf(body);
  if (!point) errors.location = "Enter a valid latitude and longitude";
  const geoPhoto = body.geoPhoto ? cleanMedia(body.geoPhoto, "geoPhoto", "IMAGE", errors) : undefined;
  failIfErrors(errors);
  return { ...values, latitude: point.lat, longitude: point.lng, geoPhoto };
};

const assertAssetCodeFree = async (assetCode, filter) => {
  const other = await InfraEquipment.findOne({ assetCode, $nor: [filter] }).select("_id").lean();
  if (other) failIfErrors({ assetCode: "This asset code is already used" });
};

const save = async (req, form, filter) => {
  const values = buildValues(form, req.body);
  await assertAssetCodeFree(values.assetCode, filter);
  const existing = await InfraEquipment.findOne(filter);
  try {
    if (existing) {
      checkVersion(existing, req.body?.version);
      existing.set({ ...values, updatedBy: actorOf(req) });
      const saved = await existing.save();
      queueStampsFor(saved);
      return saved;
    }
    const created = await InfraEquipment.create({ ...filter, ...values, capturedBy: actorOf(req), updatedBy: actorOf(req) });
    queueStampsFor(created);
    return created;
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.assetCode) failIfErrors({ assetCode: "This asset code is already used" });
      // Someone else saved the first record at the same moment
      throw conflict("This was updated on another device", "STALE");
    }
    throw error;
  }
};

const geography = (profile) => ({
  state: profile.state,
  stateCode: profile.stateCode,
  district: profile.district,
  districtCensusCode: profile.districtCensusCode,
  block: profile.block,
  blockCode: profile.blockCode,
});

// Places a GP can name as its previous / next node
const nodes = (profile) => [
  ...(profile.bhq?.name ? [{ name: profile.bhq.name, code: profile.bhq.code, kind: "BHQ" }] : []),
  ...(profile.gps || []).map((g) => ({ name: g.name, code: g.lgdCode, kind: "GP" })),
];

const firstPoint = (...candidates) => {
  const point = candidates.map(pointOf).find(Boolean);
  return point ? { latitude: point.lat, longitude: point.lng } : {};
};

// Starting values for a form not saved yet: location from the infra capture, else the profile
const blockDefaults = async (profile, formKey) => {
  const [capture, blockRecord] = await Promise.all([
    InfraCapture.findOne({ blockProfile: profile._id, level: "BLOCK" }).select("latitude longitude").lean(),
    formKey === "block" ? null : InfraEquipment.findOne({ blockProfile: profile._id, form: "block" }).select("phase").lean(),
  ]);
  const point = firstPoint(capture, profile.blockRouter, profile.bhq);
  if (formKey === "block") return { ...point, siteType: profile.siteType };
  // Block-level misc: no GP, so the LGD code is the block's
  return { ...point, phase: blockRecord?.phase, lgdCode: profile.blockCode };
};

const gpDefaults = async (profile, gp, formKey) => {
  const [capture, blockRecord] = await Promise.all([
    InfraCapture.findOne({ blockProfile: profile._id, level: "GP", gpLgdCode: gp.lgdCode }).select("latitude longitude").lean(),
    InfraEquipment.findOne({ blockProfile: profile._id, form: "block" }).select("phase").lean(),
  ]);
  const base = { ...firstPoint(capture, gp), phase: blockRecord?.phase };
  if (formKey === "gp") return { ...base, locationType: "GP", locationName: gp.name, locationCode: gp.lgdCode };
  return { ...base, lgdCode: gp.lgdCode };
};

const view = async (profile, formKey, gp, record) => ({
  form: formKey,
  target: gp ? { name: gp.name, code: gp.lgdCode } : { name: profile.block, code: profile.blockCode },
  geography: geography(profile),
  defaults: record ? {} : gp ? await gpDefaults(profile, gp, formKey) : await blockDefaults(profile, formKey),
  nodes: gp ? nodes(profile).filter((n) => n.code !== gp.lgdCode) : [],
  record,
});

// GET /api/block-profiles/:id/equipment[/:form]   (viewExecution)   form: block (default) | misc
export const getBlockEquipment = async (req, res) => {
  try {
    const formKey = req.params.form || "block";
    formOf(formKey, "BLOCK");
    const profile = await loadProfile(req.params.id);
    const record = await InfraEquipment.findOne({ blockProfile: profile._id, form: formKey, gpLgdCode: null });
    res.json(await view(profile, formKey, null, record));
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/block-profiles/:id/equipment[/:form]   (manageInfraEquipment)
export const saveBlockEquipment = async (req, res) => {
  try {
    const formKey = req.params.form || "block";
    const form = formOf(formKey, "BLOCK");
    const profile = await loadProfile(req.params.id);
    const record = await save(req, form, { blockProfile: profile._id, form: formKey, gpLgdCode: null });
    res.json(await view(profile, formKey, null, record));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/block-profiles/:id/gps/:lgdCode/equipment/:form   (viewExecution)   form: gp | misc
export const getGpEquipment = async (req, res) => {
  try {
    formOf(req.params.form, "GP");
    const profile = await loadProfile(req.params.id);
    const gp = findGp(profile, req.params.lgdCode);
    const record = await InfraEquipment.findOne({ blockProfile: profile._id, form: req.params.form, gpLgdCode: gp.lgdCode });
    res.json(await view(profile, req.params.form, gp, record));
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/block-profiles/:id/gps/:lgdCode/equipment/:form   (manageInfraEquipment)
export const saveGpEquipment = async (req, res) => {
  try {
    const form = formOf(req.params.form, "GP");
    const profile = await loadProfile(req.params.id);
    const gp = findGp(profile, req.params.lgdCode);
    const record = await save(req, form, { blockProfile: profile._id, form: req.params.form, gpLgdCode: gp.lgdCode });
    res.json(await view(profile, req.params.form, gp, record));
  } catch (error) {
    sendError(res, error);
  }
};

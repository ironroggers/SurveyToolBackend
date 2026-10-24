import { isIP } from "node:net";
import BlockProfile from "../models/blockProfile.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import { EQUIPMENT_FORMS, MISC_TYPE_TAGS, assetPrefix, blockAssetCode, miscAssetCode, miscItemsOf } from "../config/infraEquipment.js";
import { conflict, failIfErrors, notFound, sendError } from "../utils/httpError.js";
import { pointOf } from "../utils/geo.js";
import { actorOf, checkVersion, cleanMedia } from "../services/execution.service.js";
import { queueStampsFor } from "../services/stampQueue.service.js";
import { ROUTER_NAME } from "../utils/blockNodes.js";

// Equipment sheets (src/config/infraEquipment.js), filled on the web after the block
// exists: block once per block, gp once per GP, misc once per block and once per GP.

const loadProfile = async (id) => {
  const profile = await BlockProfile.findById(id).select(
    "state stateCode district districtCode districtCensusCode block blockCode gps blockRouter"
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

// extraErrors: problems found before (a misc sheet's items), reported with the rest
const buildValues = (form, body = {}, extraErrors = {}) => {
  const errors = { ...extraErrors };
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
  failIfErrors(errors);
  // The geo photo isn't part of the sheet: the mobile app saves it on its own
  return { ...values, latitude: point.lat, longitude: point.lng };
};

// A sheet counts as filled once it has been saved with its values (an asset code); before
// that a record may hold only the geo photo taken on the mobile app
const filled = (record) => (record?.assetCode ? record : null);

// A misc sheet's items: one per type, each with its asset code generated from the block
// profile and the site's LGD code (the GP's, or the block's at block level)
const buildItems = (input, profile, lgdCode) => {
  const errors = {};
  const list = Array.isArray(input) ? input : [];
  if (!list.length) errors.items = "Pick at least one type";
  else if (!assetPrefix(profile)) errors.items = "Add the state, district and block LGD codes to the block profile first";
  const seen = new Set();
  const text = (value) => String(value ?? "").trim() || undefined;
  const items = list.map((raw, i) => {
    const type = String(raw?.type ?? "").trim();
    if (!MISC_TYPE_TAGS[type]) errors[`items.${i}.type`] = "Pick from the list";
    else if (seen.has(type)) errors[`items.${i}.type`] = "Each type once";
    seen.add(type);
    return { type, assetCode: miscAssetCode(profile, lgdCode, type), model: text(raw?.model), serialNo: text(raw?.serialNo) };
  });
  return { items, errors };
};

// Each code may belong to one sheet only, as a sheet's code or one of its items'
const assertAssetCodesFree = async (codes, filter, errorKey) => {
  const list = codes.filter(Boolean);
  if (!list.length) return;
  const other = await InfraEquipment.findOne({ $or: [{ assetCode: { $in: list } }, { "items.assetCode": { $in: list } }], $nor: [filter] })
    .select("_id")
    .lean();
  if (other) failIfErrors({ [errorKey]: "This asset code is already used" });
};

const save = async (req, form, filter, profile) => {
  // The block router's asset code is generated, never typed
  const body = filter.form === "block" ? { ...req.body, assetCode: blockAssetCode(profile) } : req.body;
  if (filter.form === "block" && !body.assetCode) {
    failIfErrors({ assetCode: "Add the state, district and block LGD codes to the block profile first" });
  }
  let values;
  if (form.items) {
    const { items, errors } = buildItems(req.body?.items, profile, filter.gpLgdCode || profile.blockCode);
    values = buildValues(form, body, errors);
    // The sheet's code lists its items' codes; fields from before items are cleared
    Object.assign(values, {
      items,
      assetCode: items.map((i) => i.assetCode).join(", "),
      equipmentType: undefined,
      lgdCode: undefined,
      model: undefined,
      serialNo: undefined,
      projectStatus: undefined,
    });
    await assertAssetCodesFree(items.map((i) => i.assetCode), filter, "items");
  } else {
    values = buildValues(form, body);
    await assertAssetCodesFree([values.assetCode], filter, "assetCode");
  }
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
  districtCode: profile.districtCode,
  districtCensusCode: profile.districtCensusCode,
  block: profile.block,
  blockCode: profile.blockCode,
});

// Places a GP can name as its previous / next node
const nodes = (profile) => [
  { name: ROUTER_NAME, code: profile.blockCode, kind: "ROUTER" },
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
  const point = firstPoint(capture, profile.blockRouter);
  if (formKey === "block") return { ...point, siteType: profile.blockRouter?.siteType };
  return { ...point, phase: blockRecord?.phase };
};

const gpDefaults = async (profile, gp, formKey) => {
  const [capture, blockRecord] = await Promise.all([
    InfraCapture.findOne({ blockProfile: profile._id, level: "GP", gpLgdCode: gp.lgdCode }).select("latitude longitude").lean(),
    InfraEquipment.findOne({ blockProfile: profile._id, form: "block" }).select("phase").lean(),
  ]);
  const base = { ...firstPoint(capture, gp), phase: blockRecord?.phase };
  if (formKey === "gp") return { ...base, locationType: "GP", locationName: gp.name, locationCode: gp.lgdCode };
  return base;
};

// The record as sent to clients; a misc sheet always has its items (miscItemsOf)
const recordJson = (record) => {
  if (!record) return null;
  const json = record.toJSON ? record.toJSON() : record;
  return json.form === "misc" ? { ...json, items: miscItemsOf(json) } : json;
};

// record: the sheet once filled; geoPhoto and version also cover a photo-only record
const view = async (profile, formKey, gp, record) => ({
  form: formKey,
  target: gp ? { name: gp.name, code: gp.lgdCode } : { name: profile.block, code: profile.blockCode },
  geography: geography(profile),
  ...(formKey === "block" ? { assetCode: blockAssetCode(profile) } : {}),
  defaults: filled(record) ? {} : gp ? await gpDefaults(profile, gp, formKey) : await blockDefaults(profile, formKey),
  nodes: gp ? nodes(profile).filter((n) => n.code !== gp.lgdCode) : [],
  record: recordJson(filled(record)),
  geoPhoto: record?.geoPhoto || null,
  version: record?.toJSON ? record.toJSON().version : record?.__v,
});

// Sets or clears the geo photo alone, creating a photo-only record when the sheet isn't
// filled yet. The record takes the photo's location until the sheet gives its own.
const savePhoto = async (req, filter) => {
  const errors = {};
  const geoPhoto = req.body?.geoPhoto ? cleanMedia(req.body.geoPhoto, "geoPhoto", "IMAGE", errors) : null;
  failIfErrors(errors);
  const point = geoPhoto ? pointOf(geoPhoto) : null;
  const existing = await InfraEquipment.findOne(filter);
  try {
    if (existing) {
      existing.geoPhoto = geoPhoto || undefined;
      if (point && existing.latitude == null) Object.assign(existing, { latitude: point.lat, longitude: point.lng });
      existing.updatedBy = actorOf(req);
      const saved = await existing.save();
      queueStampsFor(saved);
      return saved;
    }
    if (!geoPhoto) return null;
    const created = await InfraEquipment.create({ ...filter, geoPhoto, latitude: point.lat, longitude: point.lng, capturedBy: actorOf(req), updatedBy: actorOf(req) });
    queueStampsFor(created);
    return created;
  } catch (error) {
    if (error.code === 11000) throw conflict("This was updated on another device", "STALE");
    throw error;
  }
};

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
    const record = await save(req, form, { blockProfile: profile._id, form: formKey, gpLgdCode: null }, profile);
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
    const record = await save(req, form, { blockProfile: profile._id, form: req.params.form, gpLgdCode: gp.lgdCode }, profile);
    res.json(await view(profile, req.params.form, gp, record));
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/block-profiles/:id/equipment/:form/geo-photo   (captureInfra)   form: block | misc
// Body { geoPhoto } (null clears it). Taken on the mobile app.
export const saveBlockEquipmentPhoto = async (req, res) => {
  try {
    const formKey = req.params.form;
    formOf(formKey, "BLOCK");
    const profile = await loadProfile(req.params.id);
    const record = await savePhoto(req, { blockProfile: profile._id, form: formKey, gpLgdCode: null });
    res.json(await view(profile, formKey, null, record));
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/block-profiles/:id/gps/:lgdCode/equipment/:form/geo-photo   (captureInfra)   form: gp | misc
export const saveGpEquipmentPhoto = async (req, res) => {
  try {
    formOf(req.params.form, "GP");
    const profile = await loadProfile(req.params.id);
    const gp = findGp(profile, req.params.lgdCode);
    const record = await savePhoto(req, { blockProfile: profile._id, form: req.params.form, gpLgdCode: gp.lgdCode });
    res.json(await view(profile, req.params.form, gp, record));
  } catch (error) {
    sendError(res, error);
  }
};

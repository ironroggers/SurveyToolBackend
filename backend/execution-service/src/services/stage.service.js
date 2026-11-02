import mongoose from "mongoose";
import BlockProfile from "../models/blockProfile.model.js";
import StageRecord from "../models/stageRecord.model.js";
import SubSection from "../models/subSection.model.js";
import { MEDIA_RULES, OPTIONS, RECORD_STAGES, STAGE_DRAFT_MESSAGES, STAGE_FIELDS, stageCode, stageMediaRuleName } from "../config/executionTypes.js";
import { badRequest, failIfErrors, notFound } from "../utils/httpError.js";
import { distanceM, round } from "../utils/geo.js";
import { cleanFix, cleanMediaSet } from "./execution.service.js";
import { findCouplingPoints, isPitKey, loadSectionPits } from "./stagePits.service.js";
import { sectionEnds } from "../utils/blockNodes.js";

// The rules for one stage record's fields. Field error keys are the config's field keys, plus
// `photos`, so clients can put each message under its field.

const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";

export const assertRecordStage = (stage) => {
  if (!RECORD_STAGES.includes(stage)) throw notFound("Stage not found");
};

const fieldShown = (f, values) =>
  (f.showIf || []).every((c) => (c.set ? !isBlank(values[c.key]) : c.in.includes(values[c.key])));

// The next number for this code in the block. Atomic, so two users at once never get the same one.
export const nextSeq = async (blockProfile, code) => {
  const block = await BlockProfile.findByIdAndUpdate(blockProfile, { $inc: { [`stageSeq.${code}`]: 1 } }, { new: true }).select("stageSeq").lean();
  return block.stageSeq[code];
};

// Blowing: blown length is |To.In − From.Out|, loop is |Out − In| at each end. An incremental
// cable has no readings; its optical length is the blown length.
const blowingLengths = (data) => {
  if (data.cable === "Incremental") return { blownLengthM: data.opticalLengthM };
  const gap = (a, b) => (a != null && b != null ? round(Math.abs(a - b), 2) : undefined);
  return {
    blownLengthM: gap(data.toIn, data.fromOut),
    fromLoopM: gap(data.fromOut, data.fromIn),
    toLoopM: gap(data.toOut, data.toIn),
  };
};

// One value against its config; errors go in `errors`. Returns the clean value.
const cleanValue = (f, raw, errors) => {
  if (f.kind === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) errors[f.key] = f.requiredMessage || "Numbers only";
    else if (f.positive && !(n > 0)) errors[f.key] = f.requiredMessage;
    else if (f.nonNegative && n < 0) errors[f.key] = "Enter 0 or more";
    else return n;
    return undefined;
  }
  if (f.kind === "choice") {
    if (OPTIONS[f.options].includes(raw)) return raw;
    errors[f.key] = "Pick one of the options";
    return undefined;
  }
  if (f.kind === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw)) && !Number.isNaN(Date.parse(raw))) return raw;
    errors[f.key] = f.requiredMessage;
    return undefined;
  }
  if (f.kind === "pit") {
    if (isPitKey(raw)) return String(raw);
    errors[f.key] = f.requiredMessage || "Pick from the list";
    return undefined;
  }
  if (f.kind === "node") {
    if (/^(GP|ROUTER):\S+/.test(String(raw))) return String(raw);
    errors[f.key] = "Pick from the list";
    return undefined;
  }
  if (f.kind === "link") {
    if (mongoose.isValidObjectId(raw)) return String(raw);
    errors[f.key] = f.requiredMessage || "Pick from the list";
    return undefined;
  }
  return String(raw).trim();
};

// Links must point at the right kind of record in this section
const checkLinks = async (stage, links, data, section, recordId, errors) => {
  const fields = STAGE_FIELDS[stage].filter((f) => f.kind === "link" && links[f.key]);
  const ids = fields.filter((f) => f.target !== "SUBSECTION").map((f) => links[f.key]);
  const targets = new Map(
    (await StageRecord.find({ _id: { $in: ids }, section: section._id }).select("stage data latitude").lean()).map((r) => [String(r._id), r])
  );
  for (const f of fields) {
    if (f.target === "SUBSECTION") {
      const sub = await SubSection.findOne({ _id: links[f.key], section: section._id, typeOfWork: { $exists: true } }).select("executionStatus end.pit.latitude").lean();
      if (!sub) errors[f.key] = "Pick a subsection of this section";
      else if (sub.executionStatus === "NOT_STARTED") errors[f.key] = "This subsection hasn't started";
      else if (sub.end?.pit?.latitude == null) errors[f.key] = "This subsection has no end pit yet";
      else {
        const used = await StageRecord.findOne({ stage: "DUCTING", "links.subSection": links[f.key], _id: { $ne: recordId } }).select("name").lean();
        if (used) errors[f.key] = `Has ${used.name}`;
      }
      continue;
    }
    const target = targets.get(String(links[f.key]));
    if (target?.stage !== f.target) errors[f.key] = "Pick from the list";
    else if (String(links[f.key]) === String(recordId)) errors[f.key] = "Pick a different record";
    else if (stage === "BLOWING" && target.latitude == null) errors[f.key] = "This chamber has no location yet";
  }
  if (stage === "BLOWING" && links.fromChamber && links.fromChamber === links.toChamber) errors.toChamber = "Pick a different chamber";
};

const pitFieldsIn = (stage, data) => STAGE_FIELDS[stage].filter((f) => f.kind === "pit" && data[f.key]);

// Pits must be pits of this section. Returns what a coupling takes from its pit.
const checkPits = async (stage, data, section, recordId, errors) => {
  const fields = pitFieldsIn(stage, data);
  if (!fields.length) return {};
  const pits = await loadSectionPits(section);
  for (const f of fields) if (!pits.byKey.has(data[f.key])) errors[f.key] = "This pit is no longer in the section";
  const needsPoint = stage === "COUPLING" || (stage === "CHAMBER" && data.atCoupling);
  if (!needsPoint) return {};
  const key = stage === "COUPLING" ? "pit" : "atCoupling";
  const pit = pits.byKey.get(data[key]);
  if (!pit) return {};
  const records = await StageRecord.find({ section: section._id, stage: { $in: ["DUCTING", "COUPLING"] } }).select("stage links data name").lean();
  const point = findCouplingPoints(pits, records.filter((r) => r.stage === "DUCTING"), records.filter((r) => r.stage === "COUPLING" && String(r._id) !== String(recordId)))
    .find((p) => p.pit === pit);
  if (!point) errors[key] = "Two duct runs don't meet at this pit";
  else if (stage === "COUPLING" && point.record) errors[key] = `Recorded as ${point.record.name}`;
  if (stage !== "COUPLING") return {};
  data.pit = pit.key;
  return { latitude: pit.latitude, longitude: pit.longitude, accuracy: pit.accuracy };
};

// A node must be one of the section's ends; a chamber sits at a coupling point or at a node, not both
const checkNodes = (stage, data, section, errors) => {
  const ends = sectionEnds(section).map((n) => n.key);
  for (const f of STAGE_FIELDS[stage].filter((x) => x.kind === "node" && data[x.key])) {
    if (!ends.includes(data[f.key])) errors[f.key] = "This is no longer an end of the section";
  }
  if (stage === "CHAMBER" && data.atCoupling && data.atNode) errors.atNode = "Pick a coupling point or the GP / block router, not both";
};

/**
 * Reference points as a pit has them: a description, a GPS fix, the tape distance to the record
 * and photos. A draft keeps whatever is given (each value still checked); `full` needs all of them.
 * `at` is the record's location, for the GPS distance the reviewer compares with the tape.
 */
const cleanRefs = (f, input, at, full, errors) => {
  if (!Array.isArray(input)) {
    if (full) errors[f.key] = f.requiredMessage;
    return undefined;
  }
  const rule = MEDIA_RULES[f.mediaRule];
  if (full && input.length < f.count) errors[f.key] = f.requiredMessage;
  return input.slice(0, f.count).map((ref = {}, i) => {
    const base = `${f.key}.${i}`;
    const description = isBlank(ref.description) ? undefined : String(ref.description).trim();
    if (full && !description) errors[`${base}.description`] = "Say what the reference point is";
    const hasFix = !isBlank(ref.latitude) && !isBlank(ref.longitude);
    const fix = hasFix || full ? cleanFix(ref, `${base}.location`, errors, "Capture GPS at the reference point") : null;
    const tape = isBlank(ref.tapeDistanceM) ? undefined : Number(ref.tapeDistanceM);
    if ((full || tape !== undefined) && !(tape > 0)) errors[`${base}.tapeDistanceM`] = "Enter the tape distance in metres";
    const gpsDistanceM = fix && at ? round(distanceM({ lat: at.latitude, lng: at.longitude }, { lat: fix.latitude, lng: fix.longitude }), 1) : undefined;
    const { photos } = cleanMediaSet(ref, full ? rule : { ...rule, minPhotos: 0 }, `${base}.`, errors, { photos: "Take a photo of the reference point" });
    return { description, ...(fix || {}), tapeDistanceM: tape > 0 ? tape : undefined, gpsDistanceM, photos };
  });
};

const mediaRuleFor = (stage, values) => MEDIA_RULES[stageMediaRuleName(stage, values)];

/**
 * What a create or update stores. A draft needs only the identity field (`draft` in the config);
 * with `full`, everything required. Values that are given are always checked.
 */
export const buildRecordValues = async (req, stage, section, { recordId, full = false } = {}) => {
  const body = req.body || {};
  const input = { ...body.data, ...body.links };
  const fields = STAGE_FIELDS[stage];
  const errors = {};
  const data = {};
  const links = {};
  let location;
  let refs;

  for (const f of fields) {
    if (f.kind === "note") continue;
    if (f.kind === "refs") {
      refs = cleanRefs(f, body[f.key], location, full, errors);
      continue;
    }
    if (f.kind === "location") {
      const given = body.location && body.location.latitude != null && body.location.latitude !== "";
      if (given) location = cleanFix(body.location, "location", errors, f.requiredMessage);
      else if (full) errors.location = f.requiredMessage;
      continue;
    }
    const raw = input[f.key];
    if (!fieldShown(f, { ...data, ...links, ...input })) continue;
    if (isBlank(raw)) {
      if (f.draft || (full && f.required)) errors[f.key] = f.requiredMessage || "Required";
      continue;
    }
    const value = cleanValue(f, raw, errors);
    if (value === undefined) continue;
    if (f.kind === "link") links[f.key] = value;
    else data[f.key] = value;
  }
  if (stage === "BLOWING") Object.assign(data, blowingLengths(data));

  const rule = mediaRuleFor(stage, data);
  const { photos } = cleanMediaSet(body, full ? rule : { ...rule, minPhotos: 0 }, "", errors);
  await checkLinks(stage, links, data, section, recordId, errors);
  checkNodes(stage, data, section, errors);
  const pitFix = await checkPits(stage, data, section, recordId, errors);
  if (pitFix.latitude !== undefined) location = pitFix;

  const identityMissing = fields.some((f) => f.draft && errors[f.key]);
  failIfErrors(errors, !full && identityMissing ? STAGE_DRAFT_MESSAGES[stage] : undefined);

  return {
    data,
    links,
    photos,
    refs,
    latitude: location?.latitude,
    longitude: location?.longitude,
    accuracy: location?.accuracy,
    accuracyAboveLimit: location?.accuracyAboveLimit,
    remarks: isBlank(body.remarks) ? undefined : String(body.remarks).trim(),
  };
};

// Submit needs everything: checks what the record already holds
export const assertRecordComplete = (record) => {
  const values = { ...record.data, ...record.toObject().links };
  const errors = {};
  for (const f of STAGE_FIELDS[record.stage]) {
    if (f.kind === "location") {
      if (record.latitude == null) errors.location = f.requiredMessage;
    } else if (f.kind === "refs") {
      const minPhotos = MEDIA_RULES[f.mediaRule].minPhotos;
      const done = (record.refs || []).filter((r) => r.description && r.latitude != null && r.tapeDistanceM > 0 && (r.photos || []).length >= minPhotos);
      if (done.length < f.count) errors[f.key] = f.requiredMessage;
    } else if (f.required && fieldShown(f, values) && isBlank(values[f.key])) {
      errors[f.key] = f.requiredMessage;
    }
  }
  if ((record.photos || []).length < mediaRuleFor(record.stage, record.data).minPhotos) errors.photos = "Take at least one photo";
  failIfErrors(errors);
};

export const codeFor = (stage, data) => {
  const code = stageCode(stage, data);
  if (!code) throw badRequest(STAGE_DRAFT_MESSAGES[stage], { type: "Pick the type" });
  return code;
};

// Other records that point at this one, by name
export const recordLinkedBy = (id) => {
  return StageRecord.findOne({ $or: [{ "links.beside": id }, { "links.fromChamber": id }, { "links.toChamber": id }] }).select("name").lean();
};

import mongoose from "mongoose";
import {
  EXECUTION_TYPES,
  MEDIA_RULES,
  OPTIONS,
  entryFieldsFor,
  executionLimits,
  isDucting,
} from "../config/executionTypes.js";
import { badRequest, conflict, failIfErrors } from "../utils/httpError.js";
import { distanceM, parseLatLong, pointOf, round } from "../utils/geo.js";

// Every rule a transition checks lives here; the controllers only load and save.
// Field error keys are the request paths, so clients can put each message under its field.

const ROLE_LABELS = {
  ADMIN: "Admin",
  "ZONAL MANAGER": "Zonal Manager",
  "CLUSTER HEAD": "Cluster Head",
  "GIS HEAD": "GIS Head",
  "FIELD EXECUTIVE": "Field Executive",
  // Older history entries
  "EXECUTION ENGINEER": "Field Executive",
  SUPERVISOR: "Supervisor",
  SURVEYOR: "Surveyor",
  VIEWER: "Viewer",
};

const trimmed = (value) => {
  const text = String(value ?? "").trim();
  return text || undefined;
};
const numberOrUndefined = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export const actorOf = (req) => {
  const { id, name, role } = req.actor || {};
  return { id, name, role };
};
export const roleLabel = (role) => ROLE_LABELS[role] || "Admin";

export const historyEntry = (req, type, text, remark) => ({
  at: new Date(),
  type,
  text,
  by: actorOf(req),
  client: req.client,
  remark,
});

// ---- versions and states

export const checkVersion = (doc, version) => {
  if (version === undefined || version === null || version === "") {
    throw badRequest("Refresh and try again", { version: "Missing version" });
  }
  if (Number(version) !== doc.__v) throw conflict("This was updated on another device", "STALE");
};

export const assertStatus = (sub, allowed, message) => {
  if (!allowed.includes(sub.executionStatus)) throw conflict(message, "WRONG_STATE");
};

// ---- locations and media

// A GPS fix: { latitude, longitude, accuracy } with the above-limit flag set here, not by the client
export const cleanFix = (input, path, errors, message) => {
  const point = pointOf(input);
  if (!point) {
    errors[path] = message;
    return null;
  }
  const accuracy = numberOrUndefined(input.accuracy);
  return {
    latitude: point.lat,
    longitude: point.lng,
    accuracy,
    accuracyAboveLimit: accuracy !== undefined && accuracy > executionLimits().accuracyLimitM,
  };
};

export const cleanMedia = (input, path, fileType, errors) => {
  if (!input) return undefined;
  const { accuracyLimitM, allowMediaUpload, videoMaxSec } = executionLimits();
  if (!/^https?:\/\//i.test(String(input.url || ""))) {
    errors[path] = "Upload the file again";
    return undefined;
  }
  const point = pointOf(input);
  if (!point) {
    errors[path] = "Add a location for this file";
    return undefined;
  }
  const source = input.source === "UPLOAD" ? "UPLOAD" : "CAMERA";
  if (source === "UPLOAD" && !allowMediaUpload) errors[path] = "Adding files from the gallery is turned off";
  const locationSource = ["GPS", "EXIF", "MANUAL"].includes(input.locationSource) ? input.locationSource : "GPS";
  const accuracy = numberOrUndefined(input.accuracy);
  const durationSec = numberOrUndefined(input.durationSec);
  // A couple of seconds of slack for how devices round the recording length
  if (fileType === "VIDEO" && durationSec !== undefined && durationSec > videoMaxSec + 2) {
    errors[path] = `Videos can be up to ${videoMaxSec} s`;
  }
  return {
    url: input.url,
    fileType,
    description: trimmed(input.description),
    latitude: String(point.lat),
    longitude: String(point.lng),
    deviceName: trimmed(input.deviceName),
    accuracy,
    place: trimmed(input.place),
    uploadedAt: input.uploadedAt || new Date(),
    s3Key: trimmed(input.s3Key),
    contentType: trimmed(input.contentType),
    sizeBytes: numberOrUndefined(input.sizeBytes),
    capturedAt: input.capturedAt || undefined,
    durationSec,
    posterUrl: /^https?:\/\//i.test(String(input.posterUrl || "")) ? input.posterUrl : undefined,
    source,
    locationSource,
    // Only a GPS fix has a meaningful accuracy; uploads are badged by source instead
    accuracyAboveLimit: locationSource === "GPS" && accuracy !== undefined && accuracy > accuracyLimitM,
  };
};

// { photos[], video } checked against a MEDIA_RULES entry. prefix: "" or "initialCondition."
export const cleanMediaSet = (input, rule, prefix, errors, messages = {}) => {
  const photosIn = Array.isArray(input?.photos) ? input.photos.filter(Boolean) : [];
  if (photosIn.length < rule.minPhotos) errors[`${prefix}photos`] = messages.photos || "Take at least one photo";
  if (photosIn.length > rule.maxPhotos) errors[`${prefix}photos`] = `Up to ${rule.maxPhotos} photos`;
  const photos = photosIn
    .slice(0, rule.maxPhotos)
    .map((media, i) => cleanMedia(media, `${prefix}photos.${i}`, "IMAGE", errors))
    .filter(Boolean);
  let video;
  if (rule.video === "required") {
    if (!input?.video) errors[`${prefix}video`] = messages.video || "Record a video";
    else video = cleanMedia(input.video, `${prefix}video`, "VIDEO", errors);
  } else if (rule.video === "optional" && input?.video) {
    video = cleanMedia(input.video, `${prefix}video`, "VIDEO", errors);
  }
  return { photos, video };
};

// ---- create

export const buildNewSubsection = (body = {}) => {
  const errors = {};
  const typeOfWork = body.typeOfWork;
  // New subsections are ducting (HDD, open trench, clamping)
  if (!EXECUTION_TYPES[typeOfWork] || !isDucting(typeOfWork)) errors.typeOfWork = "Pick the type of work";
  const roadName = trimmed(body.roadName);
  if (!roadName) errors.roadName = "Enter the road name";
  const from = parseLatLong(body.fromLatLong);
  if (!from) errors.fromLatLong = "Use GPS or enter as lat, long";
  const to = parseLatLong(body.toLatLong);
  if (!to) errors.toLatLong = "Use GPS or enter as lat, long";
  const length = Number(body.subSectionLength);
  if (!(Number.isFinite(length) && length > 0)) errors.subSectionLength = "Enter the length in metres";

  const ic = body.initialCondition || {};
  const initialCondition = { capturedAt: new Date(), remarks: trimmed(ic.remarks) };
  // Site condition is asked for ducting only
  if (isDucting(typeOfWork)) {
    if (!OPTIONS.terrain.includes(ic.terrain)) errors["initialCondition.terrain"] = "Pick the terrain";
    // Crossings: several from the list (one crossing from older clients), Others described
    const crossings = [...new Set(Array.isArray(ic.crossings) ? ic.crossings : ic.crossing ? [ic.crossing] : [])];
    if (crossings.some((c) => !OPTIONS.crossing.includes(c))) errors["initialCondition.crossings"] = "Pick crossings from the list";
    const crossingOther = crossings.includes("Others") ? trimmed(ic.crossingOther) : undefined;
    if (crossings.includes("Others") && !crossingOther) errors["initialCondition.crossingOther"] = "Describe the other crossing";
    const crossingPhotosIn = Array.isArray(ic.crossingPhotos) ? ic.crossingPhotos.filter(Boolean) : [];
    if (crossingPhotosIn.length > MEDIA_RULES.crossing.maxPhotos) errors["initialCondition.crossingPhotos"] = `Up to ${MEDIA_RULES.crossing.maxPhotos} photos`;
    const crossingPhotos = crossingPhotosIn
      .slice(0, MEDIA_RULES.crossing.maxPhotos)
      .map((m, i) => cleanMedia(m, `initialCondition.crossingPhotos.${i}`, "IMAGE", errors))
      .filter(Boolean);
    if (!OPTIONS.ofcSide.includes(ic.ofcSide)) errors["initialCondition.ofcSide"] = "Pick the OFC side";
    Object.assign(initialCondition, {
      terrain: ic.terrain,
      crossings,
      crossingOther,
      crossing: crossings.map((c) => (c === "Others" ? crossingOther || "Others" : c)).join(", ") || undefined,
      crossingPhotos,
      ofcSide: ic.ofcSide,
      roadFeatures: trimmed(ic.roadFeatures),
      authorityName: trimmed(ic.authorityName),
    });
  }
  Object.assign(
    initialCondition,
    cleanMediaSet(ic, MEDIA_RULES.siteCondition, "initialCondition.", errors, {
      photos: "Take at least one photo of the area",
      video: "Record a short video of the area",
    })
  );
  failIfErrors(errors);
  return { typeOfWork, roadName, from, to, length, initialCondition };
};

// ---- start / end

const cleanPit = (input = {}, errors) => {
  const { refPointCount } = executionLimits();
  const fix = cleanFix(input, "pit.location", errors, "Capture the pit location");
  const refsIn = Array.isArray(input.refs) ? input.refs : [];
  const refs = Array.from({ length: refPointCount }, (_, i) => {
    const ref = refsIn[i] || {};
    const base = `pit.refs.${i}`;
    const description = trimmed(ref.description);
    if (!description) errors[`${base}.description`] = "Say what the reference point is";
    const refFix = cleanFix(ref, `${base}.location`, errors, "Capture GPS at the reference point");
    const tape = numberOrUndefined(ref.tapeDistanceM);
    if (!(tape > 0)) errors[`${base}.tapeDistanceM`] = "Enter the tape distance in metres";
    const gpsDistanceM =
      fix && refFix
        ? round(distanceM({ lat: fix.latitude, lng: fix.longitude }, { lat: refFix.latitude, lng: refFix.longitude }), 1)
        : undefined;
    const media = cleanMediaSet(ref, MEDIA_RULES.refPoint, `${base}.`, errors);
    return { description, ...(refFix || {}), tapeDistanceM: tape, gpsDistanceM, ...media };
  });
  const copiedFrom = mongoose.isValidObjectId(input.copiedFrom) ? input.copiedFrom : undefined;
  // The pit's own photos and video, optional
  const media = cleanMediaSet(input, MEDIA_RULES.pit, "pit.", errors);
  return { ...(fix || {}), copiedFrom, refs, ...media };
};

// Ducting records a pit with 3 reference points; other work just its location.
// Times are the server's.
export const buildExecutionPoint = (req, sub, which) => {
  const body = req.body || {};
  const errors = {};
  let place;
  if (isDucting(sub.typeOfWork)) {
    const pit = cleanPit(body.pit, errors);
    place = { latitude: pit.latitude, longitude: pit.longitude, accuracy: pit.accuracy, accuracyAboveLimit: pit.accuracyAboveLimit, pit };
  } else {
    place = cleanFix(body, "location", errors, "Capture the location") || {};
  }
  const media = cleanMediaSet(body, MEDIA_RULES[which], "", errors, { photos: "Take at least one photo", video: "Record a video" });
  failIfErrors(errors);
  return { at: new Date(), ...place, ...media, remarks: trimmed(body.remarks), by: actorOf(req), client: req.client };
};

// "Execution started · starting pit recorded"
export const startedText = (typeOfWork) =>
  isDucting(typeOfWork) ? `Execution started · ${EXECUTION_TYPES[typeOfWork].pitA.toLowerCase()} recorded` : "Execution started";
export const endedText = (typeOfWork) =>
  isDucting(typeOfWork)
    ? `Execution ended · ${EXECUTION_TYPES[typeOfWork].pitB.toLowerCase()} recorded, sent for approval`
    : "Execution ended · sent for approval";

// ---- entries

// An entry is stored as a Trenching document so the existing trenching screens keep reading it
export const buildEntry = (req, sub) => {
  const body = req.body || {};
  const errors = {};
  const values = {};
  for (const f of entryFieldsFor(sub.typeOfWork)) {
    const raw = body[f.key];
    const empty = raw === undefined || raw === null || String(raw).trim() === "";
    if (f.kind === "number") {
      if (empty) {
        if (f.required) errors[f.key] = f.requiredMessage || "Required";
        values[f.key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[f.key] = f.required ? f.requiredMessage : "Numbers only";
      else if (f.positive && !(n > 0)) errors[f.key] = f.requiredMessage;
      else if (f.nonNegative && n < 0) errors[f.key] = "Enter 0 or more";
      else values[f.key] = n;
    } else if (f.kind === "choice") {
      if (empty) {
        if (f.required) errors[f.key] = "Pick one";
        continue;
      }
      if (!OPTIONS[f.options].includes(raw)) errors[f.key] = "Pick one of the options";
      else values[f.key] = raw;
    } else {
      const text = empty ? undefined : String(raw).trim();
      if (!text && (f.required || (f.requiredUnlessPhoto && !body.photo))) errors[f.key] = f.requiredMessage || "Required";
      values[f.key] = text;
    }
  }
  const fix = cleanFix(body, "location", errors, "Capture the location");
  const photo = body.photo ? cleanMedia(body.photo, "photo", "IMAGE", errors) : undefined;
  failIfErrors(errors);

  return {
    subSection: sub._id,
    entryType: sub.typeOfWork,
    trenchType: EXECUTION_TYPES[sub.typeOfWork].trenchType,
    trenchLength: values.length ?? 0,
    trenchDepth: values.depth ?? 0,
    temperature: values.temperature ?? null,
    angle: values.angle ?? null,
    offset: values.offset ?? null,
    side: values.side,
    landmark: values.landmark,
    protectionType: values.protection,
    clampOn: values.clampOn,
    clampMethod: values.clampMethod,
    remarks: values.remarks,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    accuracyAboveLimit: fix.accuracyAboveLimit,
    trenchLatLong: `${fix.latitude},${fix.longitude}`,
    mediaFiles: photo ? [photo] : [],
    capturedAt: new Date(),
    createdBy: actorOf(req),
  };
};

// Trenching document -> entry with the field keys from the config
export const entryView = (doc) => {
  const t = typeof doc.toJSON === "function" ? doc.toJSON() : doc;
  return {
    _id: t._id,
    length: t.trenchLength,
    depth: t.trenchDepth,
    temperature: t.temperature,
    angle: t.angle,
    offset: t.offset,
    side: t.side,
    landmark: t.landmark,
    protection: t.protectionType,
    clampOn: t.clampOn,
    clampMethod: t.clampMethod,
    remarks: t.remarks,
    latitude: t.latitude,
    longitude: t.longitude,
    accuracy: t.accuracy,
    accuracyAboveLimit: t.accuracyAboveLimit,
    photo: t.mediaFiles?.[0] || null,
    capturedAt: t.capturedAt || t.createdAt,
    createdBy: t.createdBy,
  };
};

// ---- pit suggestions (back-to-back subsections)

const plainPit = (pit) => (pit?.toObject ? pit.toObject() : pit);

/**
 * A pit this subsection's start or end can reuse: the nearest start or end pit already
 * recorded on another subsection, within pitSuggestionRadiusM of `at` (where the user is
 * now) or, without it, this subsection's planned From (start) or To (end).
 * Everything recorded comes along: location, the three reference points and all photos
 * and video, so nothing has to be captured twice.
 */
export const pitSuggestion = (sub, others, which = "start", at = null) => {
  const here = at || parseLatLong(which === "start" ? sub.fromLatLong : sub.toLatLong);
  if (!here || !isDucting(sub.typeOfWork)) return null;
  const { pitSuggestionRadiusM } = executionLimits();
  const nearest = others
    .filter((other) => String(other._id) !== String(sub._id))
    .flatMap((other) =>
      ["start", "end"]
        .filter((side) => other[side]?.pit?.latitude != null)
        .map((side) => {
          const { latitude, longitude } = other[side].pit;
          return { other, side, distance: distanceM({ lat: latitude, lng: longitude }, here) };
        })
    )
    .filter(({ distance }) => distance <= pitSuggestionRadiusM)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return null;
  const { other, side, distance } = nearest;
  const { copiedFrom: _copiedFrom, merge: _merge, ...pit } = plainPit(other[side].pit);
  return {
    which,
    subSection: other._id,
    name: other.name,
    // Which of the neighbour's pits it is: its start (A) or its end (B)
    pitLabel: EXECUTION_TYPES[other.typeOfWork]?.[side === "start" ? "pitA" : "pitB"],
    distanceM: round(distance, 1),
    pit: { ...pit, refs: pit.refs || [], copiedFrom: other._id },
  };
};

// Kept for older app versions that still ask for the start only
export const startPitSuggestion = (sub, others) => pitSuggestion(sub, others, "start");

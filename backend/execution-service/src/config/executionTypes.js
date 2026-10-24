// OFC execution rules shared by the server and both clients. The web portal and the
// mobile app render their type-specific forms, labels and media rules from this
// file (served by GET /api/execution/config), so adding a type or a field is a
// change here only.

// TODO(confirm): name codes and pit labels are the proposal from the prototype
export const EXECUTION_TYPES = {
  HDD: { label: "HDD", full: "Ducting · HDD", code: "HDD", kind: "ducting", pitA: "Starting pit", pitB: "Ending pit", methodOfConstruction: "HDD", trenchType: "HDD", aiAutofill: true },
  OT: { label: "Open Trench", full: "Ducting · Open Trench", code: "OT", kind: "ducting", pitA: "Open trench start point", pitB: "Open trench end point", methodOfConstruction: "Open Trench", trenchType: "Open Trench" },
  CLAMP: { label: "Clamping", full: "Ducting · Clamping", code: "CLP", kind: "ducting", pitA: "Coupling point 1", pitB: "Coupling point 2", methodOfConstruction: "Clamping", trenchType: "Bridge Clamping" },
  CHAMBER: { label: "Chamber", full: "Chamber", code: "CHM", kind: "basic", trenchType: "other" },
  BLOWING: { label: "Blowing", full: "Blowing", code: "BLW", kind: "basic", trenchType: "other" },
  SPLICING: { label: "Splicing", full: "Splicing", code: "SPL", kind: "basic", trenchType: "other" },
  ROUTE_MARKER: { label: "Route Marker", full: "Route Marker", code: "RM", kind: "basic", trenchType: "other" },
};

// Ducting first, then other work: the order of the type chips everywhere
export const TYPE_ORDER = ["HDD", "OT", "CLAMP", "CHAMBER", "BLOWING", "SPLICING", "ROUTE_MARKER"];
export const TYPE_GROUPS = [
  { kind: "ducting", label: "Ducting" },
  { kind: "basic", label: "Other work" },
];

export const isDucting = (typeOfWork) => EXECUTION_TYPES[typeOfWork]?.kind === "ducting";
// New subsections are ducting only; the other types stay for subsections created before
export const CREATE_TYPE_ORDER = TYPE_ORDER.filter(isDucting);

// Dropdown values exactly as on the change-request slides
export const OPTIONS = {
  terrain: ["Hilly", "Normal"],
  // Several can apply; Others asks for a description (crossingOther)
  crossing: ["Rail", "Road", "Culvert", "Bridge", "Nallah", "Others"],
  ofcSide: ["LHS", "RHS", "Road Crossing"],
  side: ["Same side", "Opposite side"],
  protection: ["DWC", "GI", "DWC PCC", "GI PCC", "RCC"],
  clampOn: ["Bridge", "Culvert", "Nallah", "IBD"],
  clampMethod: ["Side Clamp", "Utility Corridor", "Service Duct", "On the bridge", "Wall clamp"],
  referencePoint: ["Electric pole", "Telecom pole", "Culvert", "Km stone", "Tree", "Building corner"],
};

// Entry fields as data. kind: number | text | choice. `positive` means > 0; `nonNegative` means 0 or more
// (an entry may have no length, e.g. a point recorded without trenching).
// Every entry also has a location (required) and up to one photo.
const field = (key, label, kind, extra = {}) => ({ key, label, kind, required: false, ...extra });
const LENGTH = field("length", "Length (m)", "number", { unit: "m", required: true, nonNegative: true, requiredMessage: "Enter a length" });
const DEPTH = field("depth", "Depth (m)", "number", { unit: "m", required: true, requiredMessage: "Enter a depth", placeholder: "e.g. 1.2" });
const OFFSET = field("offset", "Offset (m)", "number", { unit: "m", placeholder: "e.g. 1.5" });
const LANDMARK = field("landmark", "Landmark", "text", { placeholder: "e.g. Bus shelter" });
const SIDE = field("side", "Side", "choice", { options: "side" });
const PROTECTION = field("protection", "Protection", "choice", { options: "protection" });

export const ENTRY_FIELDS = {
  HDD: [
    { ...LENGTH, placeholder: "e.g. 6" },
    DEPTH,
    field("temperature", "Temperature (°C)", "number", { unit: "°C", placeholder: "e.g. 30" }),
    field("angle", "Angle (°)", "number", { unit: "°", placeholder: "e.g. 12" }),
    OFFSET,
    LANDMARK,
    SIDE,
  ],
  OT: [{ ...LENGTH, placeholder: "e.g. 25" }, DEPTH, OFFSET, LANDMARK, SIDE, PROTECTION],
  CLAMP: [
    { ...LENGTH, placeholder: "e.g. 12" },
    { ...DEPTH, placeholder: "0 on structure" },
    OFFSET,
    LANDMARK,
    SIDE,
    PROTECTION,
    field("clampOn", "Clamp on", "choice", { options: "clampOn" }),
    field("clampMethod", "Method", "choice", { options: "clampMethod" }),
  ],
  // TODO(confirm): the client will share real fields for these types; adding them is a change here only
  basic: [
    field("remarks", "What was done here", "text", { multiline: true, requiredUnlessPhoto: true, requiredMessage: "Add a note or a photo", placeholder: "e.g. Chamber CH-03 placed" }),
  ],
};
export const entryFieldsFor = (typeOfWork) => ENTRY_FIELDS[isDucting(typeOfWork) ? typeOfWork : "basic"] || [];

// New entries start with these values from the previous entry
export const ENTRY_CARRY_OVER = ["offset", "side", "protection", "clampOn", "clampMethod"];
// HDD autofill reads these from a photo of the locator screen
export const AI_AUTOFILL_FIELDS = ["depth", "temperature", "angle"];

// Status words and tones are the same on both clients. Tone: neutral | info | warning | success | error.
export const EXECUTION_STATUSES = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  PENDING_APPROVAL: { label: "Waiting approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Needs fix", tone: "error" },
};
export const STATUS_ORDER = ["NOT_STARTED", "IN_PROGRESS", "PENDING_APPROVAL", "APPROVED", "REJECTED"];
export const ENDED_STATUSES = ["PENDING_APPROVAL", "APPROVED"];

export const RESTORATION_STATES = {
  LOCKED: { label: "Locked", tone: "neutral" },
  READY: { label: "Ready", tone: "info" },
  PENDING_APPROVAL: { label: "Waiting approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Needs fix", tone: "error" },
};

// Wizard step names
export const STEP_LABELS = {
  work: "Work & location",
  site: "Site condition",
  photos: "Before photos",
  location: "Location",
  media: "Photos & video",
};

// Media per step. video: "required" | "none"
export const MEDIA_RULES = {
  // Before photos and video are optional
  siteCondition: { minPhotos: 0, maxPhotos: 4, video: "optional" },
  // Photos of the crossings, optional
  crossing: { minPhotos: 0, maxPhotos: 4, video: "none" },
  // The pit itself and each of its reference points, optional
  pit: { minPhotos: 0, maxPhotos: 4, video: "optional" },
  refPoint: { minPhotos: 0, maxPhotos: 2, video: "optional" },
  // Start and end have no photos step any more: the pit and its reference points carry the media
  start: { minPhotos: 0, maxPhotos: 4, video: "optional" },
  end: { minPhotos: 0, maxPhotos: 4, video: "optional" },
  restorationItem: { minPhotos: 1, maxPhotos: 3, video: "required" },
  // TODO(confirm): whether all 4 infra photos are mandatory; 1 is enough for now
  infra: { minPhotos: 1, maxPhotos: 4, video: "none", descriptions: "optional" },
  entry: { minPhotos: 0, maxPhotos: 1, video: "none" },
};

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Read on each request so the env (loaded by dotenv in server.js) applies
export const executionLimits = () => ({
  // TODO(confirm): whether 1 m is realistic for phone GPS
  accuracyLimitM: envNumber("EXEC_ACCURACY_LIMIT_M", 1),
  allowMediaUpload: process.env.EXEC_ALLOW_MEDIA_UPLOAD !== "false",
  // TODO(confirm): video cap
  videoMaxSec: envNumber("EXEC_VIDEO_MAX_SEC", 60),
  gpsSampleSec: 10,
  refPointCount: 3,
  pitSuggestionRadiusM: 50,
  planDeviationPct: 10,
  // Warn when |tape − GPS| > max(minM, pct × GPS distance)
  tapeMismatch: { minM: 3, pct: 0.5 },
});

export const executionConfig = () => ({
  types: EXECUTION_TYPES,
  typeOrder: TYPE_ORDER,
  createTypeOrder: CREATE_TYPE_ORDER,
  typeGroups: TYPE_GROUPS,
  options: OPTIONS,
  entryFields: ENTRY_FIELDS,
  entryCarryOver: ENTRY_CARRY_OVER,
  aiAutofillFields: AI_AUTOFILL_FIELDS,
  statuses: EXECUTION_STATUSES,
  statusOrder: STATUS_ORDER,
  restorationStates: RESTORATION_STATES,
  stepLabels: STEP_LABELS,
  mediaRules: MEDIA_RULES,
  ...executionLimits(),
});

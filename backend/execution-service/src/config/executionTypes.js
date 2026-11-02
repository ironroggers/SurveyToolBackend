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
  // Section stages. TODO(confirm): duct size, count and colour are the prototype's proposal, no sheet lists them
  chamberType: ["MH", "HH", "LC"],
  jointType: ["BJC", "SJC"],
  position: ["LHS", "RHS"],
  ductSize: ["32 mm", "40 mm", "50 mm"],
  ductCount: ["1", "2", "3"],
  ductColour: ["Orange", "Black", "Blue", "Green"],
  yesNo: ["Yes", "No"],
  rowType: ["General", "Specific"],
  fibreCount: ["12", "24", "48", "96", "144"],
  cableKind: ["New", "Incremental"],
};

// Words for option values that differ from the value itself
export const OPTION_LABELS = {
  chamberType: { MH: "Manhole", HH: "Handhole", LC: "Loop chamber" },
  jointType: { BJC: "Joint (BJC)", SJC: "Joint (SJC)" },
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

// ---- section stages

// A section opens to these, in this order. Excavation is the subsection list and job card;
// each of the others has its own StageRecords for the section.
export const STAGES = {
  EXCAVATION: { label: "Excavation", one: "subsection", many: "subsections" },
  DUCTING: { label: "Ducting", one: "duct run", many: "duct runs", add: "Add run", empty: "Add the first one from the site.", nearest: "the nearest duct end", mediaRule: "ductRun" },
  // Coupling points are worked out from the ducts, so there is nothing to add by hand
  COUPLING: { label: "Coupling", one: "coupling", many: "couplings", empty: "A coupling point appears here when two duct runs meet at a pit.", nearest: "the nearest coupling point" },
  BLOWING: { label: "Blowing", one: "blowing run", many: "blowing runs", add: "Add run", empty: "Pick two pits to record a run of cable.", nearest: "the nearest blown cable" },
  CHAMBER: { label: "Chamber", one: "chamber", many: "chambers", add: "Add chamber", empty: "Add the first one from the site.", nearest: "the nearest chamber" },
  ROUTE_MARKER: { label: "Route marker", one: "route marker", many: "route markers", add: "Add marker", empty: "Add the first one from the site.", nearest: "the nearest marker" },
};
export const STAGE_ORDER = ["EXCAVATION", "DUCTING", "COUPLING", "BLOWING", "CHAMBER", "ROUTE_MARKER"];
export const RECORD_STAGES = STAGE_ORDER.slice(1);

// The sequence behind each name and asset code is per block and per code, because the
// workbook's asset code is block-wide. A joint closure inside a chamber has its own JC number.
export const JOINT_CODE = "JC";
// TODO(confirm): what BJC and SJC stand for
export const CHAMBER_TYPES = {
  MH: { code: "MH" },
  HH: { code: "HH" },
  // TODO(confirm): the workbook has no Loop Chamber code
  LC: { code: "LC" },
};
export const STAGE_CODES = { DUCTING: "DCT", COUPLING: "CPL", ROUTE_MARKER: "RI", BLOWING: "BLW" };
const padded = (seq) => String(seq).padStart(3, "0");
export const stageCode = (stage, data = {}) => (stage === "CHAMBER" ? CHAMBER_TYPES[data.type]?.code : STAGE_CODES[stage]);
export const stageRecordName = (stage, data, seq) =>
  ({
    CHAMBER: () => `${data.type} ${seq}`,
    DUCTING: () => `DCT-${padded(seq)}`,
    COUPLING: () => `CPL ${seq}`,
    ROUTE_MARKER: () => `RI ${seq}`,
    BLOWING: () => `BLW-${padded(seq)}`,
  })[stage]();

// Stage fields as data, like ENTRY_FIELDS, in the order the form shows them.
// Extra kinds: location (the GPS field), date, note (text on the form, no value), link (a
// picker over `target`: SUBSECTION or a stage; stored as an id so names can change safely) and
// pit (a pit from excavation, stored as `<subsection id>:<start|end>`; see stagePits.service.js).
// `draft`: needed to save a draft. `showIf`: every condition must hold; a hidden field is
// cleared and not required. `group`: a heading above this field and the ones after it.
const LOCATION = { key: "location", label: "Location", kind: "location", required: true, requiredMessage: "Capture the location" };
const POSITION = field("position", "Position", "choice", { options: "position", required: true, requiredMessage: "Pick the position", routeHint: true });
const MAKE = field("make", "Make", "text", { placeholder: "e.g. Dura-Line" });
const link = (key, label, target, extra = {}) => field(key, label, "link", { target, ...extra });
const pit = (key, label, extra = {}) => field(key, label, "pit", extra);
const reading = (key, label, end) =>
  field(key, label, "number", { end, required: true, nonNegative: true, requiredMessage: "Enter both meter readings", placeholder: end === "from" ? "1772" : "2084" });
const ifRow = { key: "rowRequired", in: ["Yes"] };
const ifJoint = { key: "hasJoint", in: ["Yes"] };

export const STAGE_FIELDS = {
  DUCTING: [
    link("subSection", "Excavation subsection", "SUBSECTION", { required: true, draft: true, requiredMessage: "Pick the subsection", placeholder: "Pick the subsection this duct runs through" }),
    field("lengthM", "Duct length laid (m)", "number", { unit: "m", required: true, positive: true, requiredMessage: "Enter the length in metres", showIf: [{ key: "subSection", set: true }] }),
    field("ductSize", "Duct size", "choice", { options: "ductSize", group: "Duct details", required: true, requiredMessage: "Pick the duct size", hint: "HDPE duct", copy: true }),
    field("ductsLaid", "Ducts laid", "choice", { options: "ductCount", required: true, requiredMessage: "Pick how many ducts", copy: true }),
    { ...MAKE, copy: true },
    field("colour", "Colour", "choice", { options: "ductColour", copy: true }),
    field("rowRequired", "Permission required", "choice", { options: "yesNo", group: "Right of way", required: true, requiredMessage: "Pick Yes or No", copy: true }),
    field("rowType", "Type", "choice", { options: "rowType", required: true, requiredMessage: "Pick the type", showIf: [ifRow], copy: true }),
    field("rowAuthority", "Authority", "text", { required: true, requiredMessage: "Enter the authority", placeholder: "e.g. PWD", showIf: [ifRow], copy: true }),
    field("rowReceived", "Permission received", "choice", { options: "yesNo", required: true, requiredMessage: "Pick Yes or No", showIf: [ifRow], copy: true }),
    field("rowValidTill", "Valid till", "date", { required: true, requiredMessage: "Pick the date", showIf: [ifRow, { key: "rowReceived", in: ["Yes"] }], copy: true }),
  ],
  // The pit is chosen from the To record list; the location is the pit's, set by the server
  COUPLING: [
    pit("pit", "Coupling point", { required: true, draft: true, fixed: true, requiredMessage: "Pick the coupling point" }),
    { ...MAKE, label: "Coupler make" },
  ],
  BLOWING: [
    pit("fromPit", "From pit", { required: true, draft: true, requiredMessage: "Pick the From pit", placeholder: "Pick a pit" }),
    pit("toPit", "To pit", { required: true, draft: true, requiredMessage: "Pick the To pit", placeholder: "Pick a pit" }),
    field("drumId", "Drum ID", "text", { group: "Cable", required: true, requiredMessage: "Enter the drum ID", placeholder: "e.g. 4075" }),
    field("fibreCount", "Fibre count", "choice", { options: "fibreCount", required: true, requiredMessage: "Pick the fibre count" }),
    field("cable", "Cable", "choice", { options: "cableKind", required: true, requiredMessage: "Pick New or Incremental" }),
    field("usedFibres", "Used fibres", "number", { nonNegative: true, placeholder: "e.g. 2" }),
    reading("fromIn", "Cable In (m)", "from"),
    reading("fromOut", "Cable Out (m)", "from"),
    reading("toIn", "Cable In (m)", "to"),
    reading("toOut", "Cable Out (m)", "to"),
  ],
  CHAMBER: [
    field("type", "Type", "choice", { options: "chamberType", required: true, draft: true, requiredMessage: "Pick the type" }),
    pit("atCoupling", "At a coupling point?", {
      chips: true,
      hint: "optional, copies its location",
      help: "Chambers go wherever suits the site, about every 1 km. Most are not at a coupling point.",
    }),
    LOCATION,
    POSITION,
    field("roadOffset", "Offset from road centre (m)", "number", { unit: "m", nonNegative: true, placeholder: "e.g. 3.6" }),
    field("landmark", "Nearby landmark", "text", { placeholder: "e.g. Electric pole" }),
    field("hasJoint", "Holds a joint closure?", "choice", { options: "yesNo", group: "Joint closure", required: true, requiredMessage: "Pick Yes or No" }),
    field("jointType", "Joint type", "choice", { options: "jointType", required: true, requiredMessage: "Pick the joint type", showIf: [ifJoint] }),
    { key: "jointNote", kind: "note", text: "Drum ID and cable readings come from Blowing.", showIf: [ifJoint] },
  ],
  ROUTE_MARKER: [
    link("beside", "Beside a chamber?", "CHAMBER", { hint: "optional, copies its location", chips: true }),
    LOCATION,
    POSITION,
    field("offset", "Offset from road centre (m)", "number", { unit: "m", required: true, nonNegative: true, requiredMessage: "Enter the offset in metres", placeholder: "e.g. 3.6" }),
  ],
};

// Words a draft needs when its identity field is missing
export const STAGE_DRAFT_MESSAGES = {
  DUCTING: "Pick the subsection to save a draft",
  COUPLING: "Pick the coupling point to save a draft",
  BLOWING: "Pick both pits to save a draft",
  CHAMBER: "Pick the type to save a draft",
};

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
  // TODO(confirm): the documents set only the size limit; 1 photo is the prototype's default
  stageRecord: { minPhotos: 1, maxPhotos: 4, video: "none", targetBytes: 400000 },
  // A stage can name its own rule with `mediaRule`. Duct run photos are optional
  ductRun: { minPhotos: 0, maxPhotos: 4, video: "none", targetBytes: 400000 },
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
  pitSuggestionRadiusM: 3,
  pitMergeMaxGapM: 3,
  // Geo photo limit from the details document, for stage records
  stagePhotoMaxBytes: 500000,
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
  optionLabels: OPTION_LABELS,
  stages: STAGES,
  stageOrder: STAGE_ORDER,
  stageFields: STAGE_FIELDS,
  stageDraftMessages: STAGE_DRAFT_MESSAGES,
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

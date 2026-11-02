import { EXECUTION_STATUSES, EXECUTION_TYPES, OPTION_LABELS, RESTORATION_STATES, STAGES, STAGE_FIELDS, STAGE_ORDER } from "../config/executionTypes.js";
import { EQUIPMENT_FORMS, MISC_ITEM_FIELDS, miscItemsOf } from "../config/infraEquipment.js";
import { SECTION_STAGES } from "../models/section.model.js";
import { routerName } from "../utils/blockNodes.js";
import { pitKey } from "./stagePits.service.js";

// What an Excel report can hold, as data: per sheet the levels it's offered at and its columns.
// The web portal's picker reads this (GET /api/reports/catalog) and report.service.js builds the
// workbook from the sheets and columns the Admin kept. Media is left out on purpose.
//
// A sheet: { key, label, description, levels, rows(rc) -> items, columns: [{ key, label, get(item, rc) }] }.
// `single`: at these levels the sheet has one item and is written as Field | Value rows.
// rc is the report context from report.service.js.

// ---- values

const TIME_ZONE = process.env.REPORT_TIME_ZONE || "Asia/Kolkata";
const timeFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// "2026-11-02 14:05" in the report's time zone; sorts as text
export const when = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = Object.fromEntries(timeFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};
const num = (value) => (value === undefined || value === null || value === "" || !Number.isFinite(Number(value)) ? "" : Number(value));
const round = (value, digits = 1) => (num(value) === "" ? "" : Number(Number(value).toFixed(digits)));
const yesNo = (value) => (value ? "Yes" : "No");
const nameOf = (actor) => actor?.name || "";
const decision = (approval) => ({ APPROVED: "Approved", REJECTED: "Rejected" })[approval?.status] || "";
const statusLabel = (key) => EXECUTION_STATUSES[key]?.label || key || "";
const sum = (items, get) => items.reduce((total, item) => total + (Number(get(item)) || 0), 0);
const SECTION_STAGE_LABELS = { FIELD: "Field review", ZONAL: "With Zonal Manager", ADMIN: "With Admin", FROZEN: "Frozen" };

const col = (key, label, get) => ({ key, label, get });
const sectionCol = col("section", "Section", (item) => item.sectionName);

// Reviews by the Cluster Head and the GIS Head, on subsections and stage records
const reviewCols = [
  col("clusterHead", "Cluster Head", (item) => decision(item.review?.clusterHead)),
  col("clusterHeadBy", "Cluster Head name", (item) => nameOf(item.review?.clusterHead?.by)),
  col("clusterHeadAt", "Cluster Head reviewed at", (item) => when(item.review?.clusterHead?.at)),
  col("clusterHeadRemark", "Cluster Head remark", (item) => item.review?.clusterHead?.remark),
  col("gisHead", "GIS Head", (item) => decision(item.review?.gisHead)),
  col("gisHeadBy", "GIS Head name", (item) => nameOf(item.review?.gisHead?.by)),
  col("gisHeadAt", "GIS Head reviewed at", (item) => when(item.review?.gisHead?.at)),
  col("gisHeadRemark", "GIS Head remark", (item) => item.review?.gisHead?.remark),
];

// ---- block

const team = (profile, role) =>
  (profile.team || [])
    .filter((m) => m.role === role)
    .map((m) => m.name)
    .filter(Boolean)
    .join(", ");

const blockSheet = {
  key: "block",
  label: "Block",
  description: "The block profile: codes, router site, team and totals",
  levels: ["BLOCK", "SECTION", "SUBSECTION"],
  single: ["BLOCK", "SECTION", "SUBSECTION"],
  rows: (rc) => [rc.profile],
  columns: [
    col("state", "State", (p) => p.state),
    col("stateCode", "State LGD code", (p) => p.stateCode),
    col("district", "District", (p) => p.district),
    col("districtCode", "District LGD code", (p) => p.districtCode),
    col("block", "Block", (p) => p.block),
    col("blockCode", "Block LGD code", (p) => p.blockCode),
    col("status", "Status", (p) => p.status),
    col("numberOfGps", "GPs (declared)", (p) => num(p.numberOfGps)),
    col("gpsListed", "GPs (listed)", (p) => (p.gps || []).length),
    col("rings", "Rings", (p) => (p.rings || []).length),
    col("numberOfRacks", "Racks", (p) => num(p.numberOfRacks)),
    col("routerName", "Block router", (p) => routerName(p)),
    col("routerSiteType", "Router site type", (p) => p.blockRouter?.siteType),
    col("routerAddress", "Router address", (p) => p.blockRouter?.address),
    col("routerLatitude", "Router latitude", (p) => num(p.blockRouter?.latitude)),
    col("routerLongitude", "Router longitude", (p) => num(p.blockRouter?.longitude)),
    col("sections", "Sections", (p, rc) => rc.allSectionCount),
    col("subsections", "Subsections", (p, rc) => rc.allSubCount),
    col("zonalManagers", "Zonal Managers", (p) => team(p, "ZONAL MANAGER")),
    col("clusterHeads", "Cluster Heads", (p) => team(p, "CLUSTER HEAD")),
    col("gisHeads", "GIS Heads", (p) => team(p, "GIS HEAD")),
    col("fieldExecutives", "Field Executives", (p) => team(p, "FIELD EXECUTIVE")),
    col("frozenAt", "Frozen at", (p) => when(p.frozen?.at)),
    col("frozenBy", "Frozen by", (p) => nameOf(p.frozen?.by)),
    col("remarks", "Remarks", (p) => p.remarks),
    col("createdAt", "Created at", (p) => when(p.createdAt)),
  ],
};

const gpsSheet = {
  key: "gps",
  label: "GPs",
  description: "Every GP of the block with its ring and whether its infra is captured",
  levels: ["BLOCK"],
  rows: (rc) => rc.profile.gps || [],
  columns: [
    col("name", "GP", (gp) => gp.name),
    col("lgdCode", "LGD code", (gp) => gp.lgdCode),
    col("ringCode", "Ring code", (gp) => gp.ringCode),
    col("latitude", "Latitude", (gp) => num(gp.latitude)),
    col("longitude", "Longitude", (gp) => num(gp.longitude)),
    col("sections", "Sections ending here", (gp, rc) => rc.sections.filter((s) => [s.fromNode, s.toNode].some((n) => n?.type === "GP" && n.code === gp.lgdCode)).length),
    col("infraCaptured", "Infra captured", (gp, rc) => yesNo(rc.infra.some((c) => c.level === "GP" && c.gpLgdCode === gp.lgdCode))),
  ],
};

const teamSheet = {
  key: "team",
  label: "Team",
  description: "The people assigned to the block",
  levels: ["BLOCK"],
  rows: (rc) => rc.profile.team || [],
  columns: [col("name", "Name", (m) => m.name), col("role", "Role", (m) => m.role)],
};

// ---- sections and their stages

const ofStage = (rc, section, stage) => rc.recordsOf(section).filter((r) => r.stage === stage);

const sectionsSheet = {
  key: "sections",
  label: "Sections",
  description: "Each section with its lengths, approval stage and stage totals",
  levels: ["BLOCK", "SECTION"],
  single: ["SECTION"],
  rows: (rc) => rc.sections,
  columns: [
    col("name", "Section", (s) => s.name),
    col("from", "From", (s, rc) => rc.view(s)?.ends[0]?.name || s.fromNode?.name),
    col("to", "To", (s, rc) => rc.view(s)?.ends[1]?.name || s.toNode?.name),
    col("routeType", "Route type", (s) => s.routeType),
    col("sectionLength", "Section length (m)", (s) => num(s.sectionLength)),
    col("mainPathLength", "Main path (m)", (s) => num(s.mainPathLength)),
    col("sharingPathLength", "Sharing path (m)", (s) => num(s.sharingPathLength)),
    col("existingIncrementalPathLength", "Existing incremental path (m)", (s) => num(s.existingIncrementalPathLength)),
    col("approvalStage", "Approval stage", (s) => SECTION_STAGE_LABELS[s.review?.stage || SECTION_STAGES[0]]),
    col("zonalDecision", "Zonal Manager decision", (s) => decision(s.review?.zonal)),
    col("zonalRemark", "Zonal Manager remark", (s) => s.review?.zonal?.remark),
    col("adminDecision", "Admin decision", (s) => decision(s.review?.admin)),
    col("adminRemark", "Admin remark", (s) => s.review?.admin?.remark),
    col("stagesComplete", "Stages complete", (s) => `${STAGE_ORDER.filter((k) => s.stageCompletion?.[k]?.at).length} of ${STAGE_ORDER.length}`),
    col("subsections", "Subsections", (s, rc) => rc.subsOf(s).length),
    col("subsectionsApproved", "Subsections approved", (s, rc) => rc.subsOf(s).filter((sub) => sub.executionStatus === "APPROVED").length),
    col("excavatedM", "Excavated (m)", (s, rc) => round(sum(rc.subsOf(s), (sub) => rc.doneM(sub)))),
    col("ductedM", "Duct laid (m)", (s, rc) => round(sum(ofStage(rc, s, "DUCTING"), (r) => r.data?.lengthM))),
    col("blownM", "Cable blown (m)", (s, rc) => round(sum(ofStage(rc, s, "BLOWING"), (r) => r.data?.blownLengthM))),
    col("couplings", "Couplings", (s, rc) => ofStage(rc, s, "COUPLING").length),
    col("chambers", "Chambers", (s, rc) => ofStage(rc, s, "CHAMBER").length),
    col("routeMarkers", "Route markers", (s, rc) => ofStage(rc, s, "ROUTE_MARKER").length),
    col("restoration", "Restoration", (s, rc) => RESTORATION_STATES[rc.restorationStatus(s)]?.label || ""),
    col("description", "Description", (s) => s.description),
  ],
};

const stagesSheet = {
  key: "stages",
  label: "Stage progress",
  description: "Excavation to Route marker per section: state, count and progress",
  levels: ["BLOCK", "SECTION"],
  rows: (rc) => rc.sections.flatMap((s) => (rc.view(s)?.stages || []).map((stage) => ({ ...stage, sectionName: s.name }))),
  columns: [
    sectionCol,
    col("stage", "Stage", (st) => st.label),
    col("state", "State", (st) => st.state?.label),
    col("count", "Count", (st) => st.count),
    col("progress", "Progress", (st) => st.summary),
    col("completeAt", "Marked complete at", (st) => when(st.complete?.at)),
    col("completeBy", "Marked complete by", (st) => nameOf(st.complete?.by)),
    col("warnings", "Warnings", (st) => (st.warnings || []).join(" ")),
    col("blockers", "Blocking completion", (st) => (st.blockers || []).join(" ")),
  ],
};

// ---- excavation: subsections, entries and pits

const pitName = (rc, sub, side) => rc.view({ _id: sub.section })?.pits.byKey.get(pitKey(sub._id, side))?.name || "";

const subsectionsSheet = {
  key: "subsections",
  label: "Subsections",
  description: "Excavation subsections with site condition, start, end and reviews",
  levels: ["BLOCK", "SECTION", "SUBSECTION"],
  single: ["SUBSECTION"],
  rows: (rc) => rc.subs,
  columns: [
    sectionCol,
    col("name", "Subsection", (s) => s.name),
    col("typeOfWork", "Type of work", (s) => EXECUTION_TYPES[s.typeOfWork]?.label || s.typeOfWork),
    col("status", "Status", (s) => statusLabel(s.executionStatus)),
    col("roadName", "Road", (s) => s.roadName),
    col("plannedLength", "Planned length (m)", (s) => num(s.subSectionLength)),
    col("calculatedLength", "Straight-line length (m)", (s) => num(s.calculatedLength)),
    col("doneM", "Excavated (m)", (s, rc) => round(rc.doneM(s))),
    col("entries", "Entries", (s, rc) => rc.entriesOf(s).length),
    col("startPit", "Start pit", (s, rc) => pitName(rc, s, "start")),
    col("endPit", "End pit", (s, rc) => pitName(rc, s, "end")),
    col("terrain", "Terrain", (s) => s.initialCondition?.terrain),
    col("crossings", "Crossings", (s) => s.initialCondition?.crossing || (s.initialCondition?.crossings || []).join(", ")),
    col("ofcSide", "OFC side", (s) => s.initialCondition?.ofcSide),
    col("roadFeatures", "Road features", (s) => s.initialCondition?.roadFeatures),
    col("authorityName", "Authority", (s) => s.initialCondition?.authorityName),
    col("siteRemarks", "Site remarks", (s) => s.initialCondition?.remarks),
    col("startAt", "Started at", (s) => when(s.start?.at)),
    col("startBy", "Started by", (s) => nameOf(s.start?.by)),
    col("startLatitude", "Start latitude", (s) => num(s.start?.pit?.latitude ?? s.start?.latitude)),
    col("startLongitude", "Start longitude", (s) => num(s.start?.pit?.longitude ?? s.start?.longitude)),
    col("endAt", "Ended at", (s) => when(s.end?.at)),
    col("endBy", "Ended by", (s) => nameOf(s.end?.by)),
    col("endLatitude", "End latitude", (s) => num(s.end?.pit?.latitude ?? s.end?.latitude)),
    col("endLongitude", "End longitude", (s) => num(s.end?.pit?.longitude ?? s.end?.longitude)),
    col("endRemarks", "End remarks", (s) => s.end?.remarks),
    ...reviewCols,
    col("createdBy", "Created by", (s) => nameOf(s.createdBy)),
    col("createdAt", "Created at", (s) => when(s.createdAt)),
    col("updatedAt", "Last updated", (s) => when(s.updatedAt)),
  ],
};

const entriesSheet = {
  key: "entries",
  label: "Entries",
  description: "Every length, depth and location recorded during excavation",
  levels: ["BLOCK", "SECTION", "SUBSECTION"],
  rows: (rc) => rc.subs.flatMap((s) => rc.entriesOf(s).map((e, i) => ({ ...e, sectionName: s.sectionName, subName: s.name, no: i + 1 }))),
  columns: [
    sectionCol,
    col("subsection", "Subsection", (e) => e.subName),
    col("no", "#", (e) => e.no),
    col("length", "Length (m)", (e) => num(e.trenchLength)),
    col("depth", "Depth (m)", (e) => num(e.trenchDepth)),
    col("temperature", "Temperature (°C)", (e) => num(e.temperature)),
    col("angle", "Angle (°)", (e) => num(e.angle)),
    col("offset", "Offset (m)", (e) => num(e.offset)),
    col("side", "Side", (e) => e.side),
    col("landmark", "Landmark", (e) => e.landmark),
    col("protection", "Protection", (e) => e.protectionType),
    col("clampOn", "Clamp on", (e) => e.clampOn),
    col("clampMethod", "Clamp method", (e) => e.clampMethod),
    col("remarks", "Remarks", (e) => e.remarks),
    col("latitude", "Latitude", (e) => num(e.latitude)),
    col("longitude", "Longitude", (e) => num(e.longitude)),
    col("accuracy", "GPS accuracy (m)", (e) => round(e.accuracy)),
    col("capturedAt", "Captured at", (e) => when(e.capturedAt || e.createdAt)),
    col("capturedBy", "Captured by", (e) => nameOf(e.createdBy)),
  ],
};

// Reference points of the subsections' pits, and of chambers above subsection level
const refRows = (rc) => {
  const fromPits = rc.subs.flatMap((s) =>
    ["start", "end"].flatMap((side) =>
      (s[side]?.pit?.refs || []).map((ref, i) => ({
        ...ref,
        sectionName: s.sectionName,
        owner: s.name,
        at: side === "start" ? "Start pit" : "End pit",
        pit: pitName(rc, s, side),
        no: i + 1,
      }))
    )
  );
  const fromChambers = rc.records
    .filter((r) => r.stage === "CHAMBER")
    .flatMap((r) => (r.refs || []).map((ref, i) => ({ ...ref, sectionName: r.sectionName, owner: r.name, at: "Chamber", pit: r.pits?.atCoupling?.name || "", no: i + 1 })));
  return [...fromPits, ...fromChambers];
};

const refsSheet = {
  key: "refPoints",
  label: "Reference points",
  description: "The fixed objects near each pit and chamber, with tape and GPS distances",
  levels: ["BLOCK", "SECTION", "SUBSECTION"],
  rows: refRows,
  columns: [
    sectionCol,
    col("owner", "Subsection / chamber", (r) => r.owner),
    col("at", "At", (r) => r.at),
    col("pit", "Pit", (r) => r.pit),
    col("no", "#", (r) => r.no),
    col("description", "Description", (r) => r.description),
    col("latitude", "Latitude", (r) => num(r.latitude)),
    col("longitude", "Longitude", (r) => num(r.longitude)),
    col("accuracy", "GPS accuracy (m)", (r) => round(r.accuracy)),
    col("tapeDistanceM", "Tape distance (m)", (r) => num(r.tapeDistanceM)),
    col("gpsDistanceM", "GPS distance (m)", (r) => round(r.gpsDistanceM)),
    col("difference", "Tape − GPS (m)", (r) => (num(r.tapeDistanceM) === "" || num(r.gpsDistanceM) === "" ? "" : round(r.tapeDistanceM - r.gpsDistanceM))),
  ],
};

// ---- stage records (Ducting, Coupling, Chamber, Blowing, Route marker)

// Field kinds with no single value to show: the location has its own columns, refs their own sheet
const SKIP_KINDS = new Set(["location", "note", "refs", "photos"]);
const END_WORDS = { from: "From chamber", to: "To chamber" };

const fieldValue = (f, r) => {
  const value = r.data?.[f.key];
  if (f.kind === "link") return r.linked?.[f.key]?.name;
  if (f.kind === "pit") return r.pits?.[f.key]?.name;
  if (f.kind === "node") return r.nodes?.[f.key]?.name;
  if (f.kind === "number") return num(value);
  if (f.kind === "choice") return OPTION_LABELS[f.options]?.[value] || value;
  return value;
};

const fieldColumns = (stage) =>
  STAGE_FIELDS[stage]
    .filter((f) => !SKIP_KINDS.has(f.kind))
    .map((f) => col(`data.${f.key}`, f.end ? `${END_WORDS[f.end]}: ${f.label}` : f.label, (r) => fieldValue(f, r)));

const located = (r) => r.latitude != null;
const STAGE_EXTRAS = {
  DUCTING: [
    col("startPit", "Start pit", (r) => r.pits?.start?.name),
    col("endPit", "End pit", (r) => r.pits?.end?.name),
    col("method", "Method", (r) => r.subsection?.typeLabel),
    col("road", "Road", (r) => r.subsection?.roadName),
    col("excavatedM", "Excavated (m)", (r) => round(r.subsection?.doneM)),
  ],
  COUPLING: [col("ducts", "Duct runs meeting", (r) => (r.ductNames || []).join(", "))],
  CHAMBER: [col("jointAssetCode", "Joint asset code", (r) => r.jointAssetCode)],
  BLOWING: [
    col("blownLengthM", "Blown length (m)", (r) => num(r.data?.blownLengthM)),
    col("fromLoopM", "Loop at From chamber (m)", (r) => num(r.data?.fromLoopM)),
    col("toLoopM", "Loop at To chamber (m)", (r) => num(r.data?.toLoopM)),
    col("ducts", "Through duct runs", (r) => (r.ductNames || []).join(", ")),
  ],
  ROUTE_MARKER: [],
};
const HAS_ASSET_CODE = ["CHAMBER", "ROUTE_MARKER"];
const HAS_LOCATION = ["COUPLING", "CHAMBER", "ROUTE_MARKER"];
const RUNS = ["DUCTING", "BLOWING"];

const stageSheet = (stage, description, levels = ["BLOCK", "SECTION"]) => ({
  key: stage === "ROUTE_MARKER" ? "routeMarker" : stage.toLowerCase(),
  label: STAGES[stage].many.replace(/^./, (c) => c.toUpperCase()),
  description,
  levels,
  rows: (rc) => rc.records.filter((r) => r.stage === stage),
  columns: [
    sectionCol,
    col("name", "Name", (r) => r.name),
    ...(HAS_ASSET_CODE.includes(stage) ? [col("assetCode", "Asset code", (r) => r.assetCode)] : []),
    col("status", "Status", (r) => statusLabel(r.status)),
    col("chainageM", RUNS.includes(stage) ? "Chainage from (m)" : "Chainage (m)", (r) => num(r.chainageM)),
    ...(RUNS.includes(stage) ? [col("chainageEndM", "Chainage to (m)", (r) => num(r.chainageEndM))] : []),
    ...fieldColumns(stage),
    ...STAGE_EXTRAS[stage],
    ...(HAS_LOCATION.includes(stage)
      ? [
          col("latitude", "Latitude", (r) => (located(r) ? num(r.latitude) : "")),
          col("longitude", "Longitude", (r) => (located(r) ? num(r.longitude) : "")),
          col("accuracy", "GPS accuracy (m)", (r) => round(r.accuracy)),
        ]
      : []),
    col("remarks", "Remarks", (r) => r.remarks),
    ...reviewCols,
    col("submittedAt", "Submitted at", (r) => when(r.submittedAt)),
    col("submittedBy", "Submitted by", (r) => nameOf(r.submittedBy)),
    col("createdBy", "Created by", (r) => nameOf(r.createdBy)),
    col("createdAt", "Created at", (r) => when(r.createdAt)),
    col("updatedAt", "Last updated", (r) => when(r.updatedAt)),
  ],
});

// ---- restoration

const restorationSheet = {
  key: "restoration",
  label: "Restoration",
  description: "Whether each subsection's area is restored, and the section's approval",
  levels: ["BLOCK", "SECTION", "SUBSECTION"],
  rows: (rc) =>
    rc.subs.map((s) => {
      const restoration = rc.restorationOf(s.section);
      return { sub: s, restoration, item: (restoration?.items || []).find((i) => String(i.subSection) === String(s._id)), status: rc.restorationStatus({ _id: s.section }) };
    }),
  columns: [
    col("section", "Section", (x) => x.sub.sectionName),
    col("subsection", "Subsection", (x) => x.sub.name),
    col("sectionStatus", "Section restoration", (x) => RESTORATION_STATES[x.status]?.label || ""),
    col("restored", "Restored", (x) => yesNo(x.item?.savedAt)),
    col("savedAt", "Saved at", (x) => when(x.item?.savedAt)),
    col("savedBy", "Saved by", (x) => nameOf(x.item?.savedBy)),
    col("remarks", "Remarks", (x) => x.item?.remarks),
    col("submittedAt", "Submitted at", (x) => when(x.restoration?.submittedAt)),
    col("submittedBy", "Submitted by", (x) => nameOf(x.restoration?.submittedBy)),
    col("decision", "Decision", (x) => decision(x.restoration?.approval)),
    col("decidedBy", "Decided by", (x) => nameOf(x.restoration?.approval?.by)),
    col("decisionRemark", "Decision remark", (x) => x.restoration?.approval?.remark),
  ],
};

// ---- block and GP infra, equipment sheets

const siteName = (rc, level, lgdCode) =>
  level === "BLOCK" ? routerName(rc.profile) : (rc.profile.gps || []).find((gp) => gp.lgdCode === lgdCode)?.name || lgdCode;

const infraSheet = {
  key: "infra",
  label: "Infra capture",
  description: "Location of the block router site and each GP, as captured on site",
  levels: ["BLOCK"],
  rows: (rc) => rc.infra,
  columns: [
    col("level", "Level", (c) => (c.level === "BLOCK" ? "Block" : "GP")),
    col("site", "Site", (c, rc) => siteName(rc, c.level, c.gpLgdCode)),
    col("lgdCode", "LGD code", (c, rc) => (c.level === "BLOCK" ? rc.profile.blockCode : c.gpLgdCode)),
    col("latitude", "Latitude", (c) => num(c.latitude)),
    col("longitude", "Longitude", (c) => num(c.longitude)),
    col("accuracy", "GPS accuracy (m)", (c) => round(c.accuracy)),
    col("capturedBy", "Captured by", (c) => nameOf(c.capturedBy)),
    col("capturedAt", "Captured at", (c) => when(c.createdAt)),
    col("updatedAt", "Last updated", (c) => when(c.updatedAt)),
  ],
};

// Columns named as on the GIS workbook (block_eqpt, gp_eqpt, misc_eqpt)
const equipmentColumns = (form) => Object.entries(EQUIPMENT_FORMS[form].fields).map(([key, f]) => col(key, f.column, (row) => (f.type === "int" || f.type === "metres" ? num(row[key]) : row[key])));
const equipmentSiteCols = [
  col("site", "Site", (row, rc) => siteName(rc, row.gpLgdCode ? "GP" : "BLOCK", row.gpLgdCode)),
  col("lgdCode", "LGD code", (row, rc) => row.gpLgdCode || rc.profile.blockCode),
];
const equipmentTailCols = [
  col("latitude", "Latitude", (row) => num(row.latitude)),
  col("longitude", "Longitude", (row) => num(row.longitude)),
  col("updatedBy", "Last updated by", (row) => nameOf(row.updatedBy || row.capturedBy)),
  col("updatedAt", "Last updated", (row) => when(row.updatedAt)),
];
const equipmentSheet = (form, label, description) => ({
  key: `${form}Equipment`,
  label,
  description,
  levels: ["BLOCK"],
  rows: (rc) => rc.equipment.filter((e) => e.form === form),
  columns: [...equipmentSiteCols, ...equipmentColumns(form), ...equipmentTailCols],
});

const miscSheet = {
  key: "miscEquipment",
  label: "Misc equipment",
  description: "Racks, FDMS, FTB, CCU, SPV, earthing and meters at each site (misc_eqpt)",
  levels: ["BLOCK"],
  rows: (rc) => rc.equipment.filter((e) => e.form === "misc").flatMap((sheet) => miscItemsOf(sheet).map((item) => ({ ...sheet, ...item, sheet }))),
  columns: [
    ...equipmentSiteCols,
    ...equipmentColumns("misc"),
    ...Object.entries(MISC_ITEM_FIELDS).map(([key, f]) => col(`item.${key}`, f.column, (row) => row[key])),
    ...equipmentTailCols,
  ],
};

// ---- history

const historyRows = (rc) => {
  const rows = (kind, sectionName, name, history) => (history || []).map((h) => ({ ...h, kind, sectionName, name }));
  return [
    ...rc.sections.flatMap((s) => (rc.level === "SUBSECTION" ? [] : rows("Section review", s.name, s.name, s.review?.history))),
    ...rc.subs.flatMap((s) => rows("Subsection", s.sectionName, s.name, s.history)),
    ...rc.records.flatMap((r) => rows(STAGES[r.stage].one.replace(/^./, (c) => c.toUpperCase()), r.sectionName, r.name, r.history)),
    ...rc.sections.flatMap((s) => (rc.level === "SUBSECTION" ? [] : rows("Restoration", s.name, "Restoration", rc.restorationOf(s._id)?.history))),
  ].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
};

const historySheet = {
  key: "history",
  label: "Approval history",
  description: "Every submit, approve, reject and reopen, oldest first",
  levels: ["BLOCK", "SECTION", "SUBSECTION"],
  rows: historyRows,
  columns: [
    col("at", "At", (h) => when(h.at)),
    sectionCol,
    col("kind", "Item type", (h) => h.kind),
    col("name", "Item", (h) => h.name),
    col("event", "Event", (h) => h.text || h.type),
    col("by", "By", (h) => nameOf(h.by)),
    col("role", "Role", (h) => h.by?.role),
    col("client", "From", (h) => h.client),
    col("remark", "Remark", (h) => h.remark),
  ],
};

// In the order they appear in the workbook and the picker
export const REPORT_SHEETS = [
  blockSheet,
  gpsSheet,
  teamSheet,
  sectionsSheet,
  stagesSheet,
  subsectionsSheet,
  entriesSheet,
  refsSheet,
  stageSheet("DUCTING", "Duct runs laid in each subsection, with duct details and right of way", ["BLOCK", "SECTION", "SUBSECTION"]),
  stageSheet("COUPLING", "Coupling points where two duct runs meet", ["BLOCK", "SECTION", "SUBSECTION"]),
  stageSheet("CHAMBER", "Chambers with type, position and joint closure"),
  stageSheet("BLOWING", "Cable blown from chamber to chamber, with drum and meter readings"),
  stageSheet("ROUTE_MARKER", "Route markers with position and offset"),
  restorationSheet,
  infraSheet,
  equipmentSheet("block", "Block equipment", "The block router sheet (Block_eqpt)"),
  equipmentSheet("gp", "GP equipment", "One router sheet per GP (gp_eqpt)"),
  miscSheet,
  historySheet,
];

export const REPORT_LEVEL_LABELS = { BLOCK: "Block", SECTION: "Section", SUBSECTION: "Subsection" };

export const sheetsFor = (level) => REPORT_SHEETS.filter((s) => s.levels.includes(level));

// GET /api/reports/catalog: what the picker offers at each level
export const reportCatalog = () =>
  Object.fromEntries(
    Object.entries(REPORT_LEVEL_LABELS).map(([level, label]) => [
      level,
      {
        label,
        sheets: sheetsFor(level).map(({ key, label: sheetLabel, description, columns }) => ({ key, label: sheetLabel, description, columns: columns.map((c) => ({ key: c.key, label: c.label })) })),
      },
    ])
  );

import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import StageRecord from "../models/stageRecord.model.js";
import SubSection from "../models/subSection.model.js";
import { CHAMBER_TYPES, EXECUTION_TYPES, OPTION_LABELS, STAGES, STAGE_ORDER, executionLimits } from "../config/executionTypes.js";
import { assetPrefix } from "../config/infraEquipment.js";
import { distanceM, fractionAlong, parseLatLong, pointOf } from "../utils/geo.js";
import { entryStats } from "./views.service.js";
import { sectionStage } from "./access.service.js";
import { collectMedia, queueStamps } from "./stampQueue.service.js";

// Read models for the stage screens. All the wording comes from here, so both clients match.

export const queueStageStamps = (record) => {
  queueStamps(collectMedia(record), { maxBytes: executionLimits().stagePhotoMaxBytes }).catch(() => null);
};

const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

// SSDDDBBBB + code + NNNN from the block's own codes; empty if a code is missing or the stage has none
export const assetCodeOf = (record, profile) => {
  if (!["CHAMBER", "ROUTE_MARKER"].includes(record.stage)) return "";
  const prefix = profile ? assetPrefix(profile) : "";
  return prefix ? `${prefix}${record.code}${String(record.seq).padStart(4, "0")}` : "";
};

// Chainage: the straight line between the section's ends scaled to its length, as on the L14
// diagram. Approximate on a winding road; null without both ends.
const chainageModel = (section) => {
  const from = parseLatLong(section.fromLatLong);
  const to = parseLatLong(section.toLatLong);
  const geo = from && to;
  const length = section.sectionLength || (geo ? distanceM(from, to) : 0);
  return { lengthM: length, at: (p) => (geo && p ? Math.round(fractionAlong(from, to, p) * length) : null) };
};

// Everything the views need about one section, in one read
const loadContext = async (section, profile) => {
  const [subDocs, records, block] = await Promise.all([
    SubSection.find({ section: section._id, typeOfWork: { $exists: true } }).select("name typeOfWork executionStatus roadName fromLatLong toLatLong subSectionLength seq initialCondition.ofcSide").sort({ seq: 1 }).lean(),
    StageRecord.find({ section: section._id }).sort({ seq: 1, code: 1 }),
    profile || BlockProfile.findById(section.blockProfile).select("stateCode districtCode blockCode").lean(),
  ]);
  const stats = await entryStats(subDocs.map((s) => s._id));
  const chainage = chainageModel(section);
  const subs = subDocs.map((s) => {
    const doneM = stats.get(String(s._id))?.doneM || 0;
    return { ...s, doneM, startM: chainage.at(parseLatLong(s.fromLatLong)) };
  });
  const views = new Map();
  const ctx = { section, block, subs, chainage, records, subById: new Map(subs.map((s) => [String(s._id), s])), byId: new Map(records.map((r) => [String(r._id), r])) };
  ctx.place = (r) => {
    const key = String(r._id);
    if (!views.has(key)) views.set(key, placeOf(r, ctx));
    return views.get(key);
  };
  return ctx;
};

// Where a record sits along the section: { chainageM, chainageEndM }
const placeOf = (r, ctx) => {
  if (r.stage === "DUCTING") {
    const sub = ctx.subById.get(String(r.links?.subSection));
    if (sub?.startM == null) return {};
    return { chainageM: sub.startM, chainageEndM: sub.startM + (Number(r.data?.lengthM) || 0) };
  }
  if (r.stage === "BLOWING") {
    const a = ctx.byId.get(String(r.links?.fromChamber));
    const b = ctx.byId.get(String(r.links?.toChamber));
    return { chainageM: a ? ctx.chainage.at(pointOf(a)) : null, chainageEndM: b ? ctx.chainage.at(pointOf(b)) : null };
  }
  return { chainageM: ctx.chainage.at(pointOf(r)) };
};

const ofStage = (ctx, stage) => ctx.records.filter((r) => r.stage === stage);
const sumOf = (records, key) => records.reduce((sum, r) => sum + (Number(r.data?.[key]) || 0), 0);
const hasLink = (r, field, id) => String(r.links?.[field]) === String(id);
const excavatedM = (ctx) => ctx.subs.reduce((sum, s) => sum + s.doneM, 0);

// How far along the route the duct runs reach from `lo` without a gap
const ductReachFrom = (ctx, lo) => {
  let reach = lo;
  const runs = ofStage(ctx, "DUCTING")
    .map((d) => ctx.place(d))
    .filter((p) => p.chainageM != null)
    .sort((a, b) => a.chainageM - b.chainageM);
  for (const run of runs) if (run.chainageM <= reach && run.chainageEndM > reach) reach = run.chainageEndM;
  return reach;
};

// Soft warnings: they never block, only tell
const stageWarnings = (ctx, stage) => {
  const w = [];
  if (stage === "DUCTING") {
    const open = ofStage(ctx, "DUCTING").filter((r) => !r.links?.startChamber || !r.links?.endChamber).length;
    if (open) w.push(`${plural(open, "duct run has", "duct runs have")} no chamber at one end.`);
    const left = ctx.subs.filter((s) => s.executionStatus !== "NOT_STARTED" && !ofStage(ctx, "DUCTING").some((d) => hasLink(d, "subSection", s._id)));
    if (left.length) w.push(`${left.map((s) => s.name).join(", ")} ${left.length === 1 ? "has" : "have"} no ducting yet.`);
  }
  if (stage === "COUPLING") {
    const runs = ofStage(ctx, "DUCTING").filter((d) => ctx.place(d).chainageM != null).sort((a, b) => ctx.place(a).chainageM - ctx.place(b).chainageM);
    const couplings = ofStage(ctx, "COUPLING");
    let gaps = 0;
    for (let i = 0; i + 1 < runs.length; i += 1) {
      const pair = [String(runs[i]._id), String(runs[i + 1]._id)];
      if (!couplings.some((c) => pair.every((id) => [String(c.links?.ductRun), String(c.links?.joinedTo)].includes(id)))) gaps += 1;
    }
    if (gaps) w.push(`${plural(gaps, "duct joint has", "duct joints have")} no coupling recorded.`);
  }
  if (stage === "ROUTE_MARKER") {
    const bare = ofStage(ctx, "CHAMBER").filter((c) => !ofStage(ctx, "ROUTE_MARKER").some((m) => hasLink(m, "beside", c._id))).length;
    if (bare) w.push(`${plural(bare, "chamber has", "chambers have")} no route marker beside it.`);
  }
  if (stage === "BLOWING") {
    const ducted = sumOf(ofStage(ctx, "DUCTING"), "lengthM");
    const blown = sumOf(ofStage(ctx, "BLOWING"), "blownLengthM");
    if (ducted > 0 && blown < ducted) w.push(`${fmtM(ducted - blown)} of laid duct has no cable blown yet.`);
    for (const b of ofStage(ctx, "BLOWING")) {
      const { chainageM, chainageEndM } = ctx.place(b);
      if (chainageM == null || chainageEndM == null) continue;
      const lo = Math.min(chainageM, chainageEndM);
      const hi = Math.max(chainageM, chainageEndM);
      const reach = ductReachFrom(ctx, lo);
      if (reach < hi) w.push(`${b.name}: no ducting recorded between the two chambers past Ch ${reach} m.`);
    }
  }
  return w;
};

// What refuses Mark stage complete
const stageBlockers = (ctx, stage) => {
  if (stage === "EXCAVATION") {
    if (!ctx.subs.length) return ["Add at least 1 subsection first."];
    const open = ctx.subs.filter((s) => ["NOT_STARTED", "IN_PROGRESS", "REJECTED"].includes(s.executionStatus)).length;
    return open ? [`${plural(open, "subsection is", "subsections are")} not finished.`] : [];
  }
  const list = ofStage(ctx, stage);
  const drafts = list.filter((r) => r.status === "IN_PROGRESS").length;
  const back = list.filter((r) => r.status === "REJECTED").length;
  return [
    drafts ? `${drafts} in progress: submit ${drafts === 1 ? "it" : "them"} first.` : "",
    back ? `${back} sent back: fix ${back === 1 ? "it" : "them"} first.` : "",
  ].filter(Boolean);
};

const stageState = (ctx, stage) => {
  const list = stage === "EXCAVATION" ? ctx.subs : ofStage(ctx, stage);
  const fixes = list.filter((r) => (r.executionStatus || r.status) === "REJECTED").length;
  if (fixes) return { key: "FIX", tone: "error", label: `${fixes} to fix` };
  if (ctx.section.stageCompletion?.[stage]?.at) return { key: "COMPLETE", tone: "success", label: "Complete" };
  if (!list.length) return { key: "NOT_STARTED", tone: "neutral", label: "Not started" };
  return { key: "IN_PROGRESS", tone: "info", label: "In progress" };
};

const stageLine = (ctx, stage) => {
  const list = ofStage(ctx, stage);
  const excavated = excavatedM(ctx);
  const ducted = sumOf(ofStage(ctx, "DUCTING"), "lengthM");
  if (stage === "EXCAVATION") return `${fmtM(excavated)} done · ${plural(ctx.subs.length, "subsection")}`;
  if (stage === "DUCTING") return `${fmtM(ducted)} laid of ${fmtM(excavated)} excavated`;
  if (stage === "BLOWING") {
    const blown = sumOf(list, "blownLengthM");
    return blown ? `${fmtM(blown)} blown of ${fmtM(ducted)} ducted` : "None recorded";
  }
  if (!list.length) return "None recorded";
  if (stage === "CHAMBER") {
    const kinds = {};
    for (const r of list) {
      const kind = CHAMBER_TYPES[r.data?.type]?.joint ? "joint" : r.data?.type;
      kinds[kind] = (kinds[kind] || 0) + 1;
    }
    return `${plural(list.length, "chamber")} · ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")}`;
  }
  return `${plural(list.length, STAGES[stage].one)} ${stage === "COUPLING" ? "recorded" : "installed"}`;
};

// The numbers behind the section's route strip
const routeView = (ctx) => ({
  lengthM: Math.round(ctx.chainage.lengthM),
  from: ctx.section.fromNode?.name,
  to: ctx.section.toNode?.name,
  excavated: ctx.subs.filter((s) => s.doneM && s.startM != null).map((s) => ({ startM: s.startM, endM: s.startM + s.doneM })),
  ducted: ofStage(ctx, "DUCTING").map((d) => ({ startM: ctx.place(d).chainageM, endM: ctx.place(d).chainageEndM })).filter((x) => x.startM != null),
  blown: ofStage(ctx, "BLOWING").map((b) => ({ startM: ctx.place(b).chainageM, endM: ctx.place(b).chainageEndM })).filter((x) => x.startM != null && x.endM != null),
  chambers: ofStage(ctx, "CHAMBER").map((r) => ctx.place(r).chainageM).filter((c) => c != null),
  couplings: ofStage(ctx, "COUPLING").map((r) => ctx.place(r).chainageM).filter((c) => c != null),
  markers: ofStage(ctx, "ROUTE_MARKER").map((r) => ctx.place(r).chainageM).filter((c) => c != null),
});

const stageSummary = (ctx, stage) => {
  const completion = ctx.section.stageCompletion?.[stage];
  return {
    key: stage,
    label: STAGES[stage].label,
    count: stage === "EXCAVATION" ? ctx.subs.length : ofStage(ctx, stage).length,
    state: stageState(ctx, stage),
    summary: stageLine(ctx, stage),
    warnings: stageWarnings(ctx, stage),
    blockers: stageBlockers(ctx, stage),
    complete: completion?.at ? { at: completion.at, by: completion.by } : null,
  };
};

// GET /api/sections/:id/stages
export const stagesView = async (section, profile) => {
  const ctx = await loadContext(section, profile);
  const stages = STAGE_ORDER.map((stage) => stageSummary(ctx, stage));
  return {
    sectionStage: sectionStage(section),
    blockFrozen: Boolean(profile?.frozen?.at),
    completeCount: stages.filter((s) => s.complete).length,
    stages,
    route: routeView(ctx),
  };
};

// GIS layer fields per record, for the detail page
const gisView = (r, ctx) => {
  const asset = assetCodeOf(r, ctx.block);
  const data = r.data || {};
  const photos = plural((r.photos || []).length, "photo");
  const status = r.status === "APPROVED" ? "EXECUTED" : "DESIGNED until approved";
  const nameOf = (id) => ctx.byId.get(String(id))?.name;
  const ll = [["lat", r.latitude], ["long", r.longitude]];
  if (r.stage === "CHAMBER" && CHAMBER_TYPES[data.type]?.joint) {
    return { layer: "joint", rows: [["type", data.type], ["asset_code", asset], ...ll, ["jc_par_stru", nameOf(r.links?.parent)], ["Joint_pos", data.position], ["geo_photo", photos], ["proj_statu", status]] };
  }
  if (r.stage === "CHAMBER") {
    return { layer: "structure", rows: [["type", data.type], ["name", r.name], ["asset code", asset], ...ll, ["stru_pos", data.position], ["geo_photo", photos], ["proj_statu", status]] };
  }
  if (r.stage === "ROUTE_MARKER") {
    return { layer: "ri", rows: [["type", "RI"], ["asset_code", asset], ...ll, ["ri_offset", data.offset != null ? `${data.offset} m` : null], ["ri_pos", data.position], ["geo_photo", photos], ["proj_statu", status]] };
  }
  const start = nameOf(r.links?.startChamber);
  const end = nameOf(r.links?.endChamber);
  if (r.stage === "DUCTING") {
    const sub = ctx.subById.get(String(r.links?.subSection));
    return {
      layer: "duct_cs",
      rows: [
        ["duct_name", `${start || "?"} TO ${end || "?"}`],
        ["seg_length", data.lengthM != null ? `${data.lengthM} m` : null],
        ["start_stru", start],
        ["end_stru", end],
        ["duct_pos", sub?.initialCondition?.ofcSide],
        ["cons_type", "U"],
        ["consmethod", EXECUTION_TYPES[sub?.typeOfWork]?.methodOfConstruction],
        ["RowPermReq", data.rowRequired],
        ["RowPrmsTyp", data.rowType],
        ["row_authrt", data.rowAuthority],
        ["permi_rcd", data.rowReceived],
        ["validty_dt", data.rowValidTill],
        ["proj_statu", status],
      ],
    };
  }
  if (r.stage === "BLOWING") {
    const from = nameOf(r.links?.fromChamber);
    const to = nameOf(r.links?.toChamber);
    return {
      layer: "ofc_cs",
      rows: [
        ["ofc_name", `${from} TO ${to}`],
        ["seg_length", data.blownLengthM != null ? `${data.blownLengthM} m` : null],
        ["start_node", from],
        ["end_node", to],
        ["fiber_size", data.fibreCount],
        ["used_fiber", data.usedFibres],
        ["s_coil_len", data.fromLoopM != null ? `${data.fromLoopM} m` : null],
        ["e_coil_len", data.toLoopM != null ? `${data.toLoopM} m` : null],
        ["proj_statu", status],
      ],
    };
  }
  return null;
};

// Readings live on the blowing record and show on both chamber detail pages
const cableReadings = (chamber, ctx) =>
  ofStage(ctx, "BLOWING").flatMap((b) => {
    const end = hasLink(b, "fromChamber", chamber._id) ? "from" : hasLink(b, "toChamber", chamber._id) ? "to" : null;
    if (!end) return [];
    const inM = b.data?.[`${end}In`];
    const outM = b.data?.[`${end}Out`];
    return [{ record: b._id, run: b.name, drum: b.data?.drumId, in: inM, out: outM, loop: b.data?.[`${end}LoopM`] }];
  });

const linkViews = (r, ctx) =>
  Object.fromEntries(
    Object.entries(r.toObject().links || {})
      .filter(([, id]) => id)
      .map(([key, id]) => [key, { _id: id, name: (key === "subSection" ? ctx.subById : ctx.byId).get(String(id))?.name }])
  );

const buildView = (r, ctx) => {
  const sub = r.stage === "DUCTING" ? ctx.subById.get(String(r.links?.subSection)) : null;
  return {
    ...r.toJSON(),
    ...ctx.place(r),
    assetCode: assetCodeOf(r, ctx.block),
    typeLabel: r.stage === "CHAMBER" ? OPTION_LABELS.chamberType[r.data?.type] : undefined,
    linked: linkViews(r, ctx),
    subsection: sub
      ? { _id: sub._id, name: sub.name, typeLabel: EXECUTION_TYPES[sub.typeOfWork]?.label, startM: sub.startM, doneM: sub.doneM, roadName: sub.roadName, side: sub.initialCondition?.ofcSide }
      : undefined,
    gis: gisView(r, ctx),
    readings: r.stage === "CHAMBER" ? cableReadings(r, ctx) : undefined,
  };
};

export const recordView = async (record) => {
  const section = await Section.findById(record.section);
  const ctx = await loadContext(section);
  return { ...buildView(ctx.byId.get(String(record._id)) || record, ctx), sectionInfo: { _id: section._id, name: section.name, stage: sectionStage(section), fromName: section.fromNode?.name, toName: section.toNode?.name } };
};

// The stage screen: its summary, its records, and what the pickers on the form need
export const recordsView = async (section, profile, stage, status) => {
  const ctx = await loadContext(section, profile);
  const all = ofStage(ctx, stage);
  const usedSubs = new Map(ofStage(ctx, "DUCTING").map((d) => [String(d.links?.subSection), { recordId: d._id, name: d.name }]));
  return {
    ...stageSummary(ctx, stage),
    sectionStage: sectionStage(section),
    blockFrozen: Boolean(profile?.frozen?.at),
    records: all.filter((r) => !status || r.status === status).map((r) => buildView(r, ctx)),
    options: {
      chambers: ofStage(ctx, "CHAMBER").map((c) => ({ _id: c._id, name: c.name, type: c.data?.type, typeLabel: OPTION_LABELS.chamberType[c.data?.type], chainageM: ctx.place(c).chainageM, status: c.status, latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy, roadOffset: c.data?.roadOffset, position: c.data?.position })),
      ductRuns: ofStage(ctx, "DUCTING").map((d) => ({ _id: d._id, name: d.name, subsectionName: ctx.subById.get(String(d.links?.subSection))?.name, lengthM: d.data?.lengthM })),
      subsections: ctx.subs.map((s) => {
        const used = usedSubs.get(String(s._id));
        return { _id: s._id, name: s.name, typeLabel: EXECUTION_TYPES[s.typeOfWork]?.label, doneM: s.doneM, startM: s.startM, roadName: s.roadName, side: s.initialCondition?.ofcSide, notStarted: s.executionStatus === "NOT_STARTED", usedBy: used };
      }),
    },
    route: routeView(ctx),
  };
};


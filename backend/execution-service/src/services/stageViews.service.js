import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import StageRecord from "../models/stageRecord.model.js";
import SubSection from "../models/subSection.model.js";
import { EXECUTION_TYPES, JOINT_CODE, OPTION_LABELS, STAGES, STAGE_ORDER, executionLimits } from "../config/executionTypes.js";
import { assetPrefix } from "../config/infraEquipment.js";
import { parseLatLong, pointOf } from "../utils/geo.js";
import { entryStats } from "./views.service.js";
import { sectionStage } from "./access.service.js";
import { collectMedia, queueStamps } from "./stampQueue.service.js";
import { PIT_SELECT, chainageModel, findCouplingPoints, pitKey, sectionPits } from "./stagePits.service.js";

// Read models for the stage screens. All the wording comes from here, so both clients match.

export const queueStageStamps = (record) => {
  queueStamps(collectMedia(record), { maxBytes: executionLimits().stagePhotoMaxBytes }).catch(() => null);
};

const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

// SSDDDBBBB + code + NNNN from the block's own codes; empty if a code is missing or the stage has none
const assetCode = (profile, code, seq) => {
  const prefix = profile ? assetPrefix(profile) : "";
  return prefix ? `${prefix}${code}${String(seq).padStart(4, "0")}` : "";
};
export const assetCodeOf = (record, profile) => (["CHAMBER", "ROUTE_MARKER"].includes(record.stage) ? assetCode(profile, record.code, record.seq) : "");

// Everything the views need about one section, in one read
const loadContext = async (section, profile) => {
  const [subDocs, records, block] = await Promise.all([
    SubSection.find({ section: section._id, typeOfWork: { $exists: true } }).select(`name typeOfWork executionStatus roadName fromLatLong toLatLong subSectionLength seq initialCondition.ofcSide ${PIT_SELECT}`).sort({ seq: 1 }).lean(),
    StageRecord.find({ section: section._id }).sort({ seq: 1, code: 1 }),
    profile || BlockProfile.findById(section.blockProfile).select("stateCode districtCode blockCode frozen").lean(),
  ]);
  const stats = await entryStats(subDocs.map((s) => s._id));
  const chainage = chainageModel(section);
  const subs = subDocs.map((s) => {
    const doneM = stats.get(String(s._id))?.doneM || 0;
    return { ...s, doneM, startM: chainage.at(parseLatLong(s.fromLatLong)) };
  });
  const views = new Map();
  const ctx = { section, block, subs, chainage, records, subById: new Map(subs.map((s) => [String(s._id), s])), byId: new Map(records.map((r) => [String(r._id), r])) };
  ctx.pits = sectionPits(subs, chainage);
  ctx.pitOf = (key) => ctx.pits.byKey.get(key);
  ctx.ductPits = (d) => ({ start: ctx.pitOf(pitKey(d.links?.subSection, "start")), end: ctx.pitOf(pitKey(d.links?.subSection, "end")) });
  ctx.points = findCouplingPoints(ctx.pits, records.filter((r) => r.stage === "DUCTING"), records.filter((r) => r.stage === "COUPLING"));
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
    const { start, end } = ctx.ductPits(r);
    if (start?.chainageM == null || end?.chainageM == null) return {};
    return { chainageM: Math.min(start.chainageM, end.chainageM), chainageEndM: Math.max(start.chainageM, end.chainageM) };
  }
  if (r.stage === "BLOWING") return { chainageM: ctx.pitOf(r.data?.fromPit)?.chainageM ?? null, chainageEndM: ctx.pitOf(r.data?.toPit)?.chainageM ?? null };
  return { chainageM: ctx.chainage.at(pointOf(r)) };
};

const ofStage = (ctx, stage) => ctx.records.filter((r) => r.stage === stage);
const sumOf = (records, key) => records.reduce((sum, r) => sum + (Number(r.data?.[key]) || 0), 0);
const hasLink = (r, field, id) => String(r.links?.[field]) === String(id);
const excavatedM = (ctx) => ctx.subs.reduce((sum, s) => sum + s.doneM, 0);

// The duct runs along a stretch of the route, and the metres of it they leave uncovered
const ductsAlong = (ctx, lo, hi) => {
  const runs = ofStage(ctx, "DUCTING")
    .filter((d) => ctx.place(d).chainageM != null && ctx.place(d).chainageM < hi && ctx.place(d).chainageEndM > lo)
    .sort((a, b) => ctx.place(a).chainageM - ctx.place(b).chainageM);
  const covered = runs.reduce((sum, d) => sum + Math.min(hi, ctx.place(d).chainageEndM) - Math.max(lo, ctx.place(d).chainageM), 0);
  return { runs, uncoveredM: Math.max(0, hi - lo - covered) };
};

// Soft warnings: they never block, only tell
const stageWarnings = (ctx, stage) => {
  const w = [];
  const before = STAGE_ORDER[STAGE_ORDER.indexOf(stage) - 1];
  if (before && before !== "EXCAVATION" && !ofStage(ctx, before).length && !ofStage(ctx, stage).length) {
    w.push(`This usually follows ${STAGES[before].label}, which has nothing recorded yet. You can still go ahead.`);
  }
  if (stage === "DUCTING") {
    const left = ctx.subs.filter((s) => s.end?.pit?.latitude != null && !ofStage(ctx, "DUCTING").some((d) => hasLink(d, "subSection", s._id)));
    if (left.length) w.push(`${left.map((s) => s.name).join(", ")} ${left.length === 1 ? "has" : "have"} both pits but no ducting yet.`);
  }
  if (stage === "COUPLING") {
    const open = ctx.points.filter((p) => !p.record).length;
    if (open) w.push(`${plural(open, "coupling point is", "coupling points are")} not recorded yet.`);
    const gone = ofStage(ctx, "COUPLING").filter((c) => !ctx.points.some((p) => p.record && String(p.record._id) === String(c._id)));
    if (gone.length) w.push(`${gone.map((c) => c.name).join(", ")}: the ducts no longer meet at this pit.`);
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
      const { uncoveredM } = ductsAlong(ctx, Math.min(chainageM, chainageEndM), Math.max(chainageM, chainageEndM));
      if (uncoveredM > 0) w.push(`${b.name}: ${fmtM(uncoveredM)} between its pits has no duct recorded.`);
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
  if (stage === "COUPLING") {
    return ctx.points.length ? `${list.length} of ${plural(ctx.points.length, "coupling point")} recorded` : "Waiting for ducts to meet at a pit";
  }
  if (!list.length) return "None recorded";
  if (stage === "CHAMBER") {
    const kinds = {};
    for (const r of list) kinds[r.data?.type] = (kinds[r.data?.type] || 0) + 1;
    const joints = list.filter((r) => r.data?.hasJoint === "Yes").length;
    return `${plural(list.length, "chamber")} · ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")}${joints ? ` · ${joints} with joint closure` : ""}`;
  }
  return `${plural(list.length, STAGES[stage].one)} installed`;
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
  pits: ctx.pits.list.map((p) => p.chainageM).filter((c) => c != null),
  couplings: ctx.points.map((p) => p.pit.chainageM).filter((c) => c != null),
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
  const ll = [["lat", r.latitude], ["long", r.longitude]];
  if (r.stage === "CHAMBER") {
    const joint = data.hasJoint === "Yes"
      ? [["joint type", data.jointType], ["joint asset_code", r.jointSeq ? assetCode(ctx.block, JOINT_CODE, r.jointSeq) : ""], ["jc_par_stru", r.name], ["Joint_pos", data.position]]
      : [];
    return { layer: joint.length ? "structure, joint" : "structure", rows: [["type", data.type], ["name", r.name], ["asset code", asset], ...ll, ["stru_pos", data.position], ...joint, ["geo_photo", photos], ["proj_statu", status]] };
  }
  if (r.stage === "ROUTE_MARKER") {
    return { layer: "ri", rows: [["type", "RI"], ["asset_code", asset], ...ll, ["ri_offset", data.offset != null ? `${data.offset} m` : null], ["ri_pos", data.position], ["geo_photo", photos], ["proj_statu", status]] };
  }
  if (r.stage === "DUCTING") {
    const { start, end } = ctx.ductPits(r);
    const sub = ctx.subById.get(String(r.links?.subSection));
    return {
      layer: "duct_cs",
      rows: [
        ["duct_name", `${start?.name || "?"} TO ${end?.name || "?"}`],
        ["seg_length", data.lengthM != null ? `${data.lengthM} m` : null],
        ["start_stru", start?.name],
        ["end_stru", end?.name],
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
    const from = ctx.pitOf(data.fromPit)?.name;
    const to = ctx.pitOf(data.toPit)?.name;
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

// Blowing runs that reach this chamber. Readings show only where a run ends at the chamber's pit;
// anywhere else along the run the cable just passes through.
const cableReadings = (chamber, ctx) => {
  const ch = ctx.place(chamber).chainageM;
  const pit = ctx.pitOf(chamber.data?.atCoupling);
  return ofStage(ctx, "BLOWING").flatMap((b) => {
    const { chainageM, chainageEndM } = ctx.place(b);
    const end = pit && pit === ctx.pitOf(b.data?.fromPit) ? "from" : pit && pit === ctx.pitOf(b.data?.toPit) ? "to" : null;
    const between = ch != null && chainageM != null && chainageEndM != null && ch >= Math.min(chainageM, chainageEndM) && ch <= Math.max(chainageM, chainageEndM);
    if (!end && !between) return [];
    const base = { record: b._id, run: b.name, drum: b.data?.drumId };
    return [end ? { ...base, in: b.data?.[`${end}In`], out: b.data?.[`${end}Out`], loop: b.data?.[`${end}LoopM`] } : { ...base, passesThrough: true }];
  });
};

// What a record's pits and ducts are called now: pit names can move, so they're never stored
const pitViews = (r, ctx) => {
  const named = (pit) => (pit ? { key: pit.key, name: pit.name, chainageM: pit.chainageM } : undefined);
  if (r.stage === "DUCTING") {
    const { start, end } = ctx.ductPits(r);
    return { pits: { start: named(start), end: named(end) } };
  }
  if (r.stage === "COUPLING") {
    const point = ctx.points.find((p) => p.record && String(p.record._id) === String(r._id));
    return { pits: { pit: named(ctx.pitOf(r.data?.pit)) }, ductNames: point?.runs.map((d) => d.name) || [] };
  }
  if (r.stage === "BLOWING") {
    const { chainageM, chainageEndM } = ctx.place(r);
    const through = chainageM != null && chainageEndM != null ? ductsAlong(ctx, Math.min(chainageM, chainageEndM), Math.max(chainageM, chainageEndM)).runs : [];
    return { pits: { fromPit: named(ctx.pitOf(r.data?.fromPit)), toPit: named(ctx.pitOf(r.data?.toPit)) }, ductNames: through.map((d) => d.name) };
  }
  if (r.stage === "CHAMBER") return { pits: { atCoupling: named(ctx.pitOf(r.data?.atCoupling)) } };
  return {};
};

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
    jointAssetCode: r.jointSeq ? assetCode(ctx.block, JOINT_CODE, r.jointSeq) : undefined,
    linked: linkViews(r, ctx),
    ...pitViews(r, ctx),
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
  return { ...buildView(ctx.byId.get(String(record._id)) || record, ctx), sectionInfo: { _id: section._id, name: section.name, stage: sectionStage(section), blockFrozen: Boolean(ctx.block?.frozen?.at), fromName: section.fromNode?.name, toName: section.toNode?.name } };
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
      ductRuns: ofStage(ctx, "DUCTING").map((d) => ({ _id: d._id, name: d.name, subsectionName: ctx.subById.get(String(d.links?.subSection))?.name, lengthM: d.data?.lengthM, ...ctx.place(d) })),
      pits: ctx.pits.list.map((p) => ({ key: p.key, keys: p.keys, name: p.name, chainageM: p.chainageM, latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, couplingPoint: ctx.points.some((c) => c.pit === p) })),
      couplingPoints: ctx.points.map((p) => ({ key: p.pit.key, name: p.pit.name, chainageM: p.pit.chainageM, latitude: p.pit.latitude, longitude: p.pit.longitude, accuracy: p.pit.accuracy, ductNames: p.runs.map((d) => d.name), recordId: p.record?._id })),
      subsections: ctx.subs.map((s) => {
        const used = usedSubs.get(String(s._id));
        const start = ctx.pitOf(pitKey(s._id, "start"));
        const end = ctx.pitOf(pitKey(s._id, "end"));
        return { _id: s._id, name: s.name, typeLabel: EXECUTION_TYPES[s.typeOfWork]?.label, doneM: s.doneM, startM: s.startM, roadName: s.roadName, side: s.initialCondition?.ofcSide, notStarted: s.executionStatus === "NOT_STARTED", noEndPit: !end, startPit: start?.name, endPit: end?.name, startPitM: start?.chainageM, endPitM: end?.chainageM, usedBy: used };
      }),
    },
    route: routeView(ctx),
  };
};


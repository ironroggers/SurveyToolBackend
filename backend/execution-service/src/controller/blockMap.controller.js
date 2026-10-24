import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Trenching from "../models/trenching.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import Restoration from "../models/restoration.model.js";
import { notFound, sendError } from "../utils/httpError.js";
import { parseLatLong, pointOf } from "../utils/geo.js";
import { sectionExecutionSummaries } from "../services/progress.service.js";
import { ROUTER_NAME } from "../utils/blockNodes.js";
import { miscItemsOf } from "../config/infraEquipment.js";

// Everything of a block that has a place on the map, in one response, for the block
// map's layers: infra captures, equipment sheets, sections, subsections (planned line, pits, reference
// points, entries) and every geotagged photo or video. Points are { lat, lng }.

// A geotagged photo or video, flattened for the map. Media without usable coordinates
// (or at 0, 0) is left out and only counted.
const mediaPoint = (m, extra) => {
  const point = pointOf(m);
  if (!point || (point.lat === 0 && point.lng === 0)) return null;
  return {
    id: String(m._id || `${extra.kind}:${m.url}`),
    url: m.url,
    posterUrl: m.posterUrl,
    fileType: m.fileType,
    ...point,
    accuracy: m.accuracy,
    accuracyAboveLimit: Boolean(m.accuracyAboveLimit),
    source: m.source || "CAMERA",
    locationSource: m.locationSource || "GPS",
    capturedAt: m.capturedAt || m.uploadedAt,
    deviceName: m.deviceName,
    place: m.place,
    description: m.description,
    ...extra,
  };
};

const pitView = (point) => {
  if (!point) return null;
  const at = pointOf(point.pit) || pointOf(point);
  return at
    ? {
        ...at,
        at: point.at,
        refs: (point.pit?.refs || [])
          .map((r) => {
            const p = pointOf(r);
            return p ? { ...p, description: r.description, tapeDistanceM: r.tapeDistanceM, gpsDistanceM: r.gpsDistanceM } : null;
          })
          .filter(Boolean),
      }
    : null;
};

// The block map's layers for one profile (needs its _id, block and gps). Also used
// by the master map, which draws many blocks on one map.
export const buildBlockMap = async (profile) => {
  const sections = await Section.find({ blockProfile: profile._id }).select("name fromNode toNode fromLatLong toLatLong sectionLength mainPathLength sharingPathLength existingIncrementalPathLength routeType").lean();
  const sectionIds = sections.map((s) => s._id);
  const [subs, captures, equipmentDocs, restorations, summaries] = await Promise.all([
    SubSection.find({ section: { $in: sectionIds } })
      .select("name section typeOfWork executionStatus roadName fromLatLong toLatLong subSectionLength seq initialCondition start end")
      .sort({ seq: 1, createdAt: 1 })
      .lean(),
    InfraCapture.find({ blockProfile: profile._id }).lean(),
    InfraEquipment.find({ blockProfile: profile._id }).select("-capturedBy -updatedBy -__v").lean(),
    Restoration.find({ section: { $in: sectionIds } }).select("section items status").lean(),
    sectionExecutionSummaries(sectionIds),
  ]);
  const entries = await Trenching.find({ subSection: { $in: subs.map((s) => s._id) } })
    .select("subSection latitude longitude trenchLatLong mediaFiles capturedAt createdAt trenchLength")
    .sort({ capturedAt: 1, createdAt: 1, _id: 1 })
    .lean();

  const sectionName = new Map(sections.map((s) => [String(s._id), s.name]));
  const subById = new Map(subs.map((s) => [String(s._id), s]));
  const gpName = new Map((profile.gps || []).map((gp) => [gp.lgdCode, gp.name]));
  const media = [];
  let withoutLocation = 0;
  const push = (m, extra) => {
    if (!m) return;
    const item = mediaPoint(m, extra);
    if (item) media.push(item);
    else withoutLocation += 1;
  };
  const subExtra = (sub, kind, label) => ({
    kind,
    label,
    subSectionId: String(sub._id),
    subSectionName: sub.name,
    sectionId: String(sub.section),
    sectionName: sectionName.get(String(sub.section)),
  });

  // ---- infra
  const infra = captures.map((c) => {
    const name = c.level === "BLOCK" ? ROUTER_NAME : gpName.get(c.gpLgdCode) || c.gpLgdCode;
    const kind = c.level === "BLOCK" ? "BLOCK_INFRA" : "GP_INFRA";
    (c.photos || []).forEach((p) =>
      push(p.media, { kind, label: c.level === "BLOCK" ? "Block infra" : `GP infra · ${name}`, description: p.description || p.media?.description, gpLgdCode: c.gpLgdCode })
    );
    const point = pointOf(c);
    return { _id: String(c._id), level: c.level, gpLgdCode: c.gpLgdCode, name, ...(point || {}), accuracy: c.accuracy, photoCount: c.photos?.length || 0, updatedAt: c.updatedAt };
  });

  // ---- equipment sheets: every value, for the info window; the geo photo joins the attachments
  const equipmentLabel = { block: "Block equipment", gp: "GP equipment", misc: "Misc equipment" };
  // A photo-only record (sheet not filled yet) adds its photo but isn't equipment yet
  const equipment = equipmentDocs.flatMap((e) => {
    const name = e.gpLgdCode ? gpName.get(e.gpLgdCode) || e.gpLgdCode : profile.block;
    push(e.geoPhoto, { kind: "EQUIPMENT", label: `${equipmentLabel[e.form]} · ${name}`, gpLgdCode: e.gpLgdCode });
    if (!e.assetCode) return [];
    const point = pointOf(e);
    return [{ ...e, _id: String(e._id), name, ...(point || {}), ...(e.form === "misc" ? { items: miscItemsOf(e) } : {}) }];
  });

  // ---- sections: a line between their nodes (or their stored lat/long text)
  const sectionViews = sections.map((s) => {
    const from = pointOf(s.fromNode) || parseLatLong(s.fromLatLong);
    const to = pointOf(s.toNode) || parseLatLong(s.toLatLong);
    const summary = summaries.get(String(s._id));
    return {
      _id: String(s._id),
      name: s.name,
      from,
      to,
      fromName: s.fromNode?.name,
      toName: s.toNode?.name,
      // { type: ROUTER | GP, code, name } of each end, for the topology diagram
      fromNode: s.fromNode ? { type: s.fromNode.type, code: s.fromNode.code, name: s.fromNode.name } : null,
      toNode: s.toNode ? { type: s.toNode.type, code: s.toNode.code, name: s.toNode.name } : null,
      sectionLength: s.sectionLength,
      mainPathLength: s.mainPathLength,
      sharingPathLength: s.sharingPathLength,
      existingIncrementalPathLength: s.existingIncrementalPathLength,
      routeType: s.routeType || "NEW",
      counts: summary?.counts,
      total: summary?.total || 0,
      restorationStatus: summary?.restoration?.status,
    };
  });

  // ---- entries, grouped per subsection in capture order
  const entriesBySub = new Map();
  for (const e of entries) {
    const key = String(e.subSection);
    const point = pointOf(e) || parseLatLong(e.trenchLatLong);
    if (!entriesBySub.has(key)) entriesBySub.set(key, []);
    if (point) entriesBySub.get(key).push({ ...point, length: e.trenchLength, capturedAt: e.capturedAt || e.createdAt });
    const sub = subById.get(key);
    if (sub) (e.mediaFiles || []).forEach((m) => push(m, subExtra(sub, "ENTRY", `Entry · ${sub.name}`)));
  }

  // ---- subsections
  const subViews = subs.map((sub) => {
    const ic = sub.initialCondition || {};
    [...(ic.photos || []), ic.video].forEach((m) => push(m, subExtra(sub, "SITE", `Site condition · ${sub.name}`)));
    ["start", "end"].forEach((which) => {
      const point = sub[which];
      [...(point?.photos || []), point?.video].forEach((m) =>
        push(m, subExtra(sub, which === "start" ? "START" : "END", `${which === "start" ? "Start" : "End"} · ${sub.name}`))
      );
    });
    return {
      _id: String(sub._id),
      name: sub.name,
      sectionId: String(sub.section),
      sectionName: sectionName.get(String(sub.section)),
      typeOfWork: sub.typeOfWork,
      executionStatus: sub.executionStatus,
      legacy: !sub.typeOfWork,
      roadName: sub.roadName,
      subSectionLength: sub.subSectionLength,
      seq: sub.seq,
      // Site condition, for the L14 diagram
      crossing: ic.crossing,
      terrain: ic.terrain,
      ofcSide: ic.ofcSide,
      from: parseLatLong(sub.fromLatLong),
      to: parseLatLong(sub.toLatLong),
      start: pitView(sub.start),
      end: pitView(sub.end),
      entries: entriesBySub.get(String(sub._id)) || [],
    };
  });

  // ---- restoration (after photos and videos)
  for (const r of restorations) {
    for (const item of r.items || []) {
      const sub = subById.get(String(item.subSection));
      if (!sub) continue;
      [...(item.photos || []), item.video].forEach((m) => push(m, subExtra(sub, "RESTORATION", `Restoration · ${sub.name}`)));
    }
  }

  return { infra, equipment, sections: sectionViews, subsections: subViews, media, mediaWithoutLocation: withoutLocation };
};

// GET /api/block-profiles/:id/map   (viewExecution)
export const getBlockMap = async (req, res) => {
  try {
    const profile = await BlockProfile.findById(req.params.id).select("block blockCode gps").lean();
    if (!profile) throw notFound("Block profile not found");
    res.json(await buildBlockMap(profile));
  } catch (error) {
    sendError(res, error);
  }
};

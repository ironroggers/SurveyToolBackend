import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Trenching from "../models/trenching.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import Restoration from "../models/restoration.model.js";
import { EXECUTION_TYPES, isDucting } from "../config/executionTypes.js";
import { subsectionName } from "../utils/subsectionName.js";
import { endedText, startedText } from "../services/execution.service.js";
import { DEMO_MEDIA_ROUTE, makeDemoPhoto, makeDemoVideo, resetDemoMediaDir, runPool, writeDemoFile } from "./demoMedia.js";

// The demo block: one complete, realistic block for demonstrations, shown to ADMIN
// only (isDemo). resetDemoBlock() deletes it and everything under it and builds it
// again, so it can be changed freely during a demo and then put back.
//
// What it shows:
//   Block router (the block's head node) + 6 GPs (two without infra), KML of the road route
//   Block infra and 4 GP infra captures with described photos
//   S1 Harippad → Karuvatta      every type of work, all approved, restoration approved
//   S2 Karuvatta → Pallippad     all approved, restoration waiting approval (approve it)
//   S3 Pallippad → Veeyapuram    approved, waiting approval (with flags), needs fix
//   S4 Veeyapuram → Harippad     all ended, restoration ready with one item saved (closes a ring)
//   S5 Harippad → Cheruthana     in progress with entries, not started
//   S6 Cheruthana → Kumarapuram  no subsections yet (create one)
//   S7 Karuvatta → Thrikkunnapuzha an existing route (dashed), no work; makes Karuvatta a branch
//
// Sections run along real roads (demoRoads.json, routed once from OpenStreetMap and kept
// here so a reset needs no network). The nodes sit on those roads, section lengths are
// road lengths, and subsections, pits and entries are placed along the road. The KML
// file is the road path, which the maps use to draw sections and subsections.

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const oid = () => new mongoose.Types.ObjectId();

const EE = { id: new mongoose.Types.ObjectId("64d0000000000000000000e1"), name: "Ravi Kumar", role: "EXECUTION ENGINEER" };
const EE2 = { id: new mongoose.Types.ObjectId("64d0000000000000000000e2"), name: "Suresh Nair", role: "EXECUTION ENGINEER" };
const SUP = { id: new mongoose.Types.ObjectId("64d0000000000000000000b1"), name: "Anil Menon", role: "SUPERVISOR" };
const ADMIN = { id: new mongoose.Types.ObjectId("64d0000000000000000000a1"), name: "Admin", role: "ADMIN" };
const DEVICE = "Pixel 8 · Android 15";

// ---- geometry: road paths and metres around a point

const ROADS = JSON.parse(readFileSync(new URL("./demoRoads.json", import.meta.url), "utf8"));
const nodePoint = (code) => ({ lat: ROADS.nodes[code][1], lng: ROADS.nodes[code][0] });
const ROUTER = nodePoint("ROUTER");
const at = (northM, eastM, from = ROUTER) => ({
  lat: +(from.lat + northM / 110540).toFixed(6),
  lng: +(from.lng + eastM / (111320 * Math.cos((from.lat * Math.PI) / 180))).toFixed(6),
});
const lerp = (a, b, t) => ({ lat: +(a.lat + (b.lat - a.lat) * t).toFixed(6), lng: +(a.lng + (b.lng - a.lng) * t).toFixed(6) });
const dist = (a, b) => {
  const dy = (b.lat - a.lat) * 110540;
  const dx = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
const ll = (p) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;

// The road from one node to another, as [{ lat, lng }] with the metres run at each vertex
const roadBetween = (from, to) => {
  const forward = ROADS.roads[`${from}>${to}`];
  const coords = forward || [...ROADS.roads[`${to}>${from}`]].reverse();
  const path = coords.map(([lng, lat]) => ({ lat, lng }));
  const runs = [0];
  for (let i = 1; i < path.length; i += 1) runs.push(runs[i - 1] + dist(path[i - 1], path[i]));
  return { path, runs, length: runs[runs.length - 1] };
};
// The point `metres` along a road from its start and `side` metres to its left (negative:
// right), e.g. a pole or km stone on the roadside
const roadside = ({ path, runs, length }, metres, side = 0) => {
  const target = Math.min(Math.max(metres, 0), length);
  let i = 1;
  while (i < runs.length - 1 && runs[i] < target) i += 1;
  const a = path[i - 1];
  const b = path[i];
  const span = runs[i] - runs[i - 1];
  const p = lerp(a, b, span ? (target - runs[i - 1]) / span : 0);
  if (!side || !span) return p;
  const north = (b.lat - a.lat) * 110540;
  const east = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const len = Math.hypot(north, east);
  return at((east / len) * side, (-north / len) * side, p);
};
// The point at share t (0..1) of the way along a road
const along = ({ path, runs, length }, t) => {
  const target = Math.min(Math.max(t, 0), 1) * length;
  let i = 1;
  while (i < runs.length - 1 && runs[i] < target) i += 1;
  const span = runs[i] - runs[i - 1];
  return lerp(path[i - 1], path[i], span ? (target - runs[i - 1]) / span : 0);
};

const GPS = [
  { name: "KARUVATTA", lgdCode: "990101" },
  { name: "PALLIPPAD", lgdCode: "990102" },
  { name: "VEEYAPURAM", lgdCode: "990103" },
  { name: "CHERUTHANA", lgdCode: "990104" },
  { name: "KUMARAPURAM", lgdCode: "990105" },
  { name: "THRIKKUNNAPUZHA", lgdCode: "990106" },
].map((g) => ({ ...g, p: nodePoint(g.lgdCode) }));
const gp = (code) => GPS.find((g) => g.lgdCode === code);
// Block LGD codes are 4 digits; 9999 keeps the demo apart from real blocks
const BLOCK_CODE = "9999";
// The block router is the block's head node: { type: ROUTER, code: blockCode }
const ROUTER_NODE = { type: "ROUTER", code: BLOCK_CODE, name: "Block router", latitude: ROUTER.lat, longitude: ROUTER.lng };
const node = (code) => (code === "ROUTER" ? ROUTER_NODE : { type: "GP", code, name: gp(code).name, latitude: gp(code).p.lat, longitude: gp(code).p.lng });
const pointOfNode = (n) => ({ lat: n.latitude, lng: n.longitude });
// A road leaving a node, starting at it: for points around the router or a GP
const roadFrom = (code) => {
  const [from, to] = Object.keys(ROADS.roads)
    .find((key) => key.split(">").includes(code))
    .split(">");
  return from === code ? roadBetween(from, to) : roadBetween(to, from);
};

const placeNear = (road, area) => `${road}, ${area}, Harippad, Alappuzha, Kerala 690514, India`;

// ---- the build

export const resetDemoBlock = async ({ baseUrl }) => {
  await deleteDemoBlock();
  await resetDemoMediaDir();

  const now = Date.now();
  const t = (daysAgo, hours = 10) => new Date(now - daysAgo * DAY + (hours - 10) * HOUR);
  const mediaJobs = [];
  const url = (file) => `${baseUrl}${DEMO_MEDIA_ROUTE}/${file}`;
  let mediaSeq = 0;

  // A MediaFile whose demo file is generated after the records are built
  const media = (fileType, { kind, title, subtitle, point, when, place, accuracy = 0.6, source = "CAMERA", locationSource = "GPS", aboveLimit = false, device = DEVICE }) => {
    const name = `m${String(++mediaSeq).padStart(4, "0")}`;
    const meta = { latitude: point.lat, longitude: point.lng, accuracy: locationSource === "MANUAL" ? undefined : accuracy, place, capturedAt: when, deviceName: device, source, locationSource };
    const isVideo = fileType === "VIDEO";
    const m = {
      _id: oid(),
      url: url(`${name}.${isVideo ? "mp4" : "jpg"}`),
      fileType,
      latitude: String(point.lat),
      longitude: String(point.lng),
      accuracy: meta.accuracy,
      place,
      deviceName: device,
      uploadedAt: when,
      capturedAt: when,
      contentType: isVideo ? "video/mp4" : "image/jpeg",
      source,
      locationSource,
      accuracyAboveLimit: aboveLimit,
      ...(isVideo ? { durationSec: 3, posterUrl: url(`${name}-poster.jpg`) } : {}),
    };
    mediaJobs.push(async () => {
      const made = isVideo ? await makeDemoVideo({ name, kind, title, subtitle, meta }) : await makeDemoPhoto({ name, kind, title, subtitle, meta });
      m.sizeBytes = made.sizeBytes;
    });
    return m;
  };
  const photo = (o) => media("IMAGE", o);
  const video = (o) => media("VIDEO", o);
  const hist = (when, type, text, by, client = "mobile", remark) => ({ at: when, type, text, by, client, remark });

  // ---- block profile
  const blockId = oid();
  const block = {
    _id: blockId,
    isDemo: true,
    state: "KERALA",
    stateCode: "32",
    district: "ALAPPUZHA",
    districtCode: "591",
    districtCensusCode: "591",
    block: "HARIPPAD (DEMO)",
    blockCode: BLOCK_CODE,
    numberOfGps: GPS.length,
    gps: GPS.map((g) => ({ name: g.name, lgdCode: g.lgdCode, latitude: g.p.lat, longitude: g.p.lng })),
    numberOfRacks: 2,
    remarks: "Demonstration block with complete sample data. Visible to admins only; Reset demo block puts it back.",
    blockRouter: { siteType: "BSNL_OWNED", latitude: ROUTER.lat, longitude: ROUTER.lng, address: "Harippad Telephone Exchange, NH 66, Harippad, Kerala 690514" },
    kmlFiles: [],
    status: "ACTIVE",
    createdBy: ADMIN.id,
    updatedBy: ADMIN.id,
    createdAt: t(60),
    updatedAt: t(1),
  };

  // ---- infra: the block router site and 4 of the 6 GPs
  const infraDocs = [];
  // Taken a few metres apart along the road from the site
  const infraPhotos = (area, code, when, labels) =>
    labels.map((description, i) => ({
      media: photo({ kind: "INFRA", title: description, subtitle: area, point: roadside(roadFrom(code), i * 4), when: new Date(when.getTime() + i * 60000), place: placeNear("NH 66", area) }),
      description,
    }));
  infraDocs.push({
    _id: oid(),
    blockProfile: blockId,
    level: "BLOCK",
    gpLgdCode: null,
    latitude: ROUTER.lat,
    longitude: ROUTER.lng,
    accuracy: 0.6,
    photos: infraPhotos("Harippad", "ROUTER", t(55), ["Exchange building front with signboard", "Rack room · OLT and FDMS position", "Cable entry point at the back wall", "Approach road from NH 66"]),
    capturedBy: SUP,
    updatedBy: SUP,
    createdAt: t(55),
    updatedAt: t(55),
  });
  ["990101", "990102", "990103", "990104"].forEach((code, i) => {
    const g = gp(code);
    infraDocs.push({
      _id: oid(),
      blockProfile: blockId,
      level: "GP",
      gpLgdCode: code,
      latitude: g.p.lat,
      longitude: g.p.lng,
      accuracy: 0.7,
      photos: infraPhotos(g.name, code, t(50 - i * 3), ["GP office front", "Equipment position inside the office"]),
      capturedBy: i % 2 ? EE2 : EE,
      updatedBy: i % 2 ? EE2 : EE,
      createdAt: t(50 - i * 3),
      updatedAt: t(50 - i * 3),
    });
  });

  // ---- sections, subsections, entries, restorations
  const sections = [];
  const subs = [];
  const entries = [];
  const restorations = [];
  // Halfway along each subsection's road, where its restoration photos are taken
  const midpoints = new Map();

  // On the roadside near the pit: near(metres along the road from the pit, metres to its left)
  const refPoints = (pit, near, mismatch = false) =>
    [
      ["Electric pole", 6, 4],
      ["Km stone", -8, -3.5],
      ["Tree", 3, -5],
    ].map(([description, alongM, sideM], i) => {
      const p = near(alongM, sideM);
      const gpsM = +dist(pit, p).toFixed(1);
      return { description, latitude: p.lat, longitude: p.lng, accuracy: 0.7, tapeDistanceM: mismatch && i === 1 ? +(gpsM + 9).toFixed(1) : gpsM, gpsDistanceM: gpsM };
    });

  const point = (sub, which, p, when, by, area, opts = {}) => {
    const type = EXECUTION_TYPES[sub.typeOfWork];
    const label = isDucting(sub.typeOfWork) ? (which === "start" ? type.pitA : type.pitB) : which === "start" ? "Start" : "End";
    const place = placeNear(sub.roadName, area);
    return {
      at: when,
      latitude: p.lat,
      longitude: p.lng,
      accuracy: 0.6,
      ...(isDucting(sub.typeOfWork) ? { pit: { latitude: p.lat, longitude: p.lng, accuracy: 0.6, refs: refPoints(p, opts.near, opts.mismatch) } } : {}),
      photos: [photo({ kind: which === "start" ? "START" : "END", title: label, subtitle: sub.name, point: p, when, place, accuracy: opts.photoAccuracy ?? 0.6, aboveLimit: Boolean(opts.photoAccuracy && opts.photoAccuracy > 1) })],
      video: video({ kind: which === "start" ? "START" : "END", title: label, subtitle: sub.name, point: p, when: new Date(when.getTime() + 120000), place }),
      remarks: which === "start" ? "Pit opened, machine positioned" : "Pit closed, end cap fixed",
      by,
      client: "mobile",
    };
  };

  const ENTRY_FIELDS = {
    HDD: (i) => ({ trenchDepth: +(1.6 + (i % 4) * 0.15).toFixed(2), temperature: 28 + (i % 3), angle: i % 5, offset: 1.5, side: "Same side" }),
    OT: (i) => ({ trenchDepth: +(1.2 + (i % 3) * 0.1).toFixed(2), offset: 1.5 + (i % 2) * 0.5, side: "Same side", protectionType: "DWC", landmark: i === 2 ? "Bus shelter" : undefined }),
    CLAMP: (i) => ({ trenchDepth: 0, offset: 0.5, side: "Opposite side", protectionType: "GI", clampOn: "Bridge", clampMethod: i % 2 ? "Wall clamp" : "Side Clamp" }),
  };

  // Entries spread along the subsection's road; doneShare of the planned length is covered.
  // pos(share) is the point at that share of the way from the subsection's start to its end.
  const addEntries = (sub, pos, startAt, endAt, by, area, doneShare) => {
    const ducting = isDucting(sub.typeOfWork);
    if (ducting) {
      const n = Math.max(2, Math.min(10, Math.round(sub.subSectionLength / 30)));
      const each = (sub.subSectionLength * doneShare) / n;
      for (let i = 0; i < n; i += 1) {
        const p = pos(((i + 1) / n) * doneShare);
        const when = new Date(startAt.getTime() + ((endAt.getTime() - startAt.getTime()) * (i + 1)) / (n + 1));
        entries.push({
          _id: oid(),
          subSection: sub._id,
          entryType: sub.typeOfWork,
          trenchType: EXECUTION_TYPES[sub.typeOfWork].trenchType,
          trenchLength: +each.toFixed(1),
          ...ENTRY_FIELDS[sub.typeOfWork](i),
          latitude: p.lat,
          longitude: p.lng,
          accuracy: 0.6 + (i % 3) * 0.1,
          trenchLatLong: `${p.lat},${p.lng}`,
          mediaFiles: i % 3 === 0 ? [photo({ kind: "ENTRY", title: `Entry #${i + 1}`, subtitle: sub.name, point: p, when, place: placeNear(sub.roadName, area) })] : [],
          capturedAt: when,
          createdBy: by,
          createdAt: when,
          updatedAt: when,
        });
      }
      return;
    }
    const remarksFor = {
      CHAMBER: (i) => `Chamber ${i + 1} built, cover fixed`,
      ROUTE_MARKER: (i) => `Route marker RM-${i + 1} installed`,
      SPLICING: () => "Splicing done at the chamber, 24F",
      BLOWING: (i, n) => `Cable blown ${Math.round((i / n) * 100)}% → ${Math.round(((i + 1) / n) * 100)}% of the section`,
    };
    const n = { CHAMBER: 3, ROUTE_MARKER: 4, SPLICING: 1, BLOWING: 2 }[sub.typeOfWork] || 1;
    const count = Math.max(1, Math.round(n * doneShare));
    for (let i = 0; i < count; i += 1) {
      const p = pos(n === 1 ? 0.5 : (i + 0.5) / n);
      const when = new Date(startAt.getTime() + ((endAt.getTime() - startAt.getTime()) * (i + 1)) / (count + 1));
      entries.push({
        _id: oid(),
        subSection: sub._id,
        entryType: sub.typeOfWork,
        trenchType: "other",
        trenchLength: 0,
        trenchDepth: 0,
        remarks: remarksFor[sub.typeOfWork](i, n),
        latitude: p.lat,
        longitude: p.lng,
        accuracy: 0.7,
        trenchLatLong: `${p.lat},${p.lng}`,
        mediaFiles: [photo({ kind: "ENTRY", title: remarksFor[sub.typeOfWork](i, n), subtitle: sub.name, point: p, when, place: placeNear(sub.roadName, area) })],
        capturedAt: when,
        createdBy: by,
        createdAt: when,
        updatedAt: when,
      });
    }
  };

  /**
   * One section and its subsections.
   * plan: [{ type, t0, t1, status, crossing?, remark?, flags? }]   (t = share of the way From → To)
   */
  const buildSection = ({ name, from, to, road, area, daysAgo, plan, restoration, routeType = "NEW" }) => {
    const fromNode = node(from);
    const toNode = node(to);
    const a = pointOfNode(fromNode);
    const b = pointOfNode(toNode);
    const route = roadBetween(from, to);
    const section = {
      _id: oid(),
      name,
      description: `${fromNode.name} to ${toNode.name} along ${road}`,
      blockProfile: blockId,
      state: block.state,
      stateCode: block.stateCode,
      district: block.district,
      districtCode: block.districtCode,
      block: block.block,
      blockCode: block.blockCode,
      fromNode: { type: fromNode.type, code: fromNode.code, name: fromNode.name, latitude: fromNode.latitude, longitude: fromNode.longitude },
      toNode: { type: toNode.type, code: toNode.code, name: toNode.name, latitude: toNode.latitude, longitude: toNode.longitude },
      fromLatLong: ll(a),
      toLatLong: ll(b),
      sectionLength: Math.round(route.length / 10) * 10,
      routeType,
      status: plan.length ? 2 : 1,
      subSectionSeq: plan.length,
      createdAt: t(daysAgo + 2),
      updatedAt: t(1),
    };
    // Kept for the KML file, not stored on the section
    sections.push({ ...section, roadPath: route.path });

    plan.forEach((step, i) => {
      const type = EXECUTION_TYPES[step.type];
      const seq = i + 1;
      const p0 = along(route, step.t0);
      const p1 = along(route, step.t1);
      const pos = (share) => along(route, step.t0 + (step.t1 - step.t0) * share);
      const near = (t) => (alongM, sideM) => roadside(route, route.length * t + alongM, sideM);
      const by = i % 3 === 2 ? EE2 : EE;
      const created = t(daysAgo - i * 1.2, 9);
      const started = new Date(created.getTime() + DAY);
      const ended = new Date(started.getTime() + 2 * DAY + i * HOUR);
      const decided = new Date(ended.getTime() + DAY);
      const sub = {
        _id: oid(),
        section: section._id,
        typeOfWork: step.type,
        seq,
        name: subsectionName(road, step.type, seq),
        roadName: road,
        fromLatLong: ll(p0),
        toLatLong: ll(p1),
        subSectionLength: Math.max(1, Math.round(route.length * (step.t1 - step.t0))),
        methodOfConstruction: type.methodOfConstruction,
        executionStatus: step.status,
        createdBy: by,
        updatedBy: by,
        createdAt: created,
        updatedAt: created,
        history: [hist(created, "created", "Created with site condition photos and video", by)],
        __v: 0,
      };
      const ducting = isDucting(step.type);
      sub.initialCondition = {
        capturedAt: created,
        ...(ducting
          ? { terrain: "Normal", crossing: step.crossing, ofcSide: i % 2 ? "RHS" : "LHS", roadFeatures: "Two-lane bitumen road, drain on the left", authorityName: "PWD Roads, Harippad section" }
          : {}),
        remarks: "Surface intact, no existing damage",
        photos: [
          photo({ kind: "SITE", title: "Site condition", subtitle: sub.name, point: p0, when: created, place: placeNear(road, area) }),
          photo({ kind: "SITE", title: "Site condition", subtitle: sub.name, point: pos(0.5), when: new Date(created.getTime() + 300000), place: placeNear(road, area), ...(step.flags?.upload ? { source: "UPLOAD", locationSource: "MANUAL", device: "Gallery upload" } : {}) }),
        ],
        video: video({ kind: "SITE", title: "Site condition", subtitle: sub.name, point: p0, when: new Date(created.getTime() + 600000), place: placeNear(road, area) }),
      };

      if (step.status !== "NOT_STARTED") {
        sub.start = point(sub, "start", p0, started, by, area, { near: near(step.t0) });
        sub.history.push(hist(started, "started", startedText(step.type), by));
        sub.__v += 1;
      }
      const endedStatuses = ["PENDING_APPROVAL", "APPROVED", "REJECTED"];
      addEntries(sub, pos, started, step.status === "IN_PROGRESS" ? new Date(now - 2 * HOUR) : ended, by, area, step.status === "IN_PROGRESS" ? 0.6 : step.status === "NOT_STARTED" ? 0 : 1);
      if (endedStatuses.includes(step.status)) {
        sub.end = point(sub, "end", p1, ended, by, area, { near: near(step.t1), mismatch: step.flags?.mismatch, photoAccuracy: step.flags?.aboveLimit ? 2.4 : undefined });
        sub.history.push(hist(ended, "ended", endedText(step.type), by));
        sub.__v += 2;
      }
      if (step.status === "APPROVED") {
        sub.approval = { status: "APPROVED", by: ADMIN, at: decided, client: "web" };
        sub.history.push(hist(decided, "approved", "Approved by Admin", ADMIN, "web"));
        sub.__v += 1;
      }
      if (step.status === "REJECTED") {
        sub.approval = { status: "REJECTED", by: ADMIN, at: decided, remark: step.remark, client: "web" };
        sub.history.push(hist(decided, "rejected", `Needs fix (Admin): ${step.remark}`, ADMIN, "web", step.remark));
        sub.__v += 1;
      }
      sub.updatedAt = sub.history[sub.history.length - 1].at;
      subs.push(sub);
      midpoints.set(String(sub._id), pos(0.5));
    });

    // Restoration: after photos and a video per subsection
    if (restoration) {
      const own = subs.filter((s) => s.section.equals(section._id));
      const savedAt = t(restoration.daysAgo ?? 3);
      const items = own.slice(0, restoration.items ?? own.length).map((s, i) => {
        const p = midpoints.get(String(s._id));
        const when = new Date(savedAt.getTime() + i * HOUR);
        return {
          subSection: s._id,
          photos: [photo({ kind: "RESTORATION", title: "After restoration", subtitle: s.name, point: p, when, place: placeNear(road, area) })],
          video: video({ kind: "RESTORATION", title: "After restoration", subtitle: s.name, point: p, when: new Date(when.getTime() + 120000), place: placeNear(road, area) }),
          remarks: "Trench backfilled, surface restored",
          savedAt: when,
          savedBy: EE,
        };
      });
      const doc = { _id: oid(), section: section._id, items, history: [], updatedBy: EE, createdAt: savedAt, updatedAt: savedAt, __v: items.length };
      if (restoration.status) {
        const submitted = new Date(savedAt.getTime() + 6 * HOUR);
        doc.status = "PENDING_APPROVAL";
        doc.submittedAt = submitted;
        doc.submittedBy = EE;
        doc.history.push(hist(submitted, "submitted", "Restoration sent for approval", EE));
        doc.__v += 1;
        if (restoration.status === "APPROVED") {
          const decided = new Date(submitted.getTime() + DAY);
          doc.status = "APPROVED";
          doc.approval = { status: "APPROVED", by: ADMIN, at: decided, client: "web" };
          doc.history.push(hist(decided, "approved", "Approved by Admin · section restored and closed", ADMIN, "web"));
          doc.__v += 1;
        }
        doc.updatedAt = doc.history[doc.history.length - 1].at;
      }
      restorations.push(doc);
    }
  };

  const ALL_TYPES = (status) => [
    { type: "HDD", t0: 0, t1: 0.14, status, crossing: "Road" },
    { type: "OT", t0: 0.14, t1: 0.5, status },
    { type: "CLAMP", t0: 0.5, t1: 0.57, status, crossing: "Bridge" },
    { type: "OT", t0: 0.57, t1: 0.88, status },
    { type: "HDD", t0: 0.88, t1: 1, status, crossing: "Nallah" },
    { type: "CHAMBER", t0: 0, t1: 1, status },
    { type: "BLOWING", t0: 0, t1: 1, status },
    { type: "SPLICING", t0: 0.45, t1: 0.55, status },
    { type: "ROUTE_MARKER", t0: 0, t1: 1, status },
  ];

  buildSection({ name: "Harippad → Karuvatta", from: "ROUTER", to: "990101", road: "NH 66", area: "Karuvatta", daysAgo: 45, plan: ALL_TYPES("APPROVED"), restoration: { status: "APPROVED", daysAgo: 20 } });
  buildSection({
    name: "Karuvatta → Pallippad",
    from: "990101",
    to: "990102",
    road: "Karuvatta Road",
    area: "Pallippad",
    daysAgo: 35,
    plan: [
      { type: "HDD", t0: 0, t1: 0.2, status: "APPROVED", crossing: "Road" },
      { type: "OT", t0: 0.2, t1: 1, status: "APPROVED" },
      { type: "CHAMBER", t0: 0, t1: 1, status: "APPROVED" },
    ],
    restoration: { status: "PENDING_APPROVAL", daysAgo: 6 },
  });
  buildSection({
    name: "Pallippad → Veeyapuram",
    from: "990102",
    to: "990103",
    road: "Pallippad Road",
    area: "Veeyapuram",
    daysAgo: 22,
    plan: [
      { type: "HDD", t0: 0, t1: 0.18, status: "APPROVED", crossing: "Culvert" },
      { type: "OT", t0: 0.18, t1: 0.62, status: "PENDING_APPROVAL", flags: { mismatch: true, aboveLimit: true, upload: true } },
      { type: "CLAMP", t0: 0.62, t1: 0.7, status: "REJECTED", crossing: "Bridge", remark: "Clamp photos on the bridge side are missing. Add them and resubmit." },
      { type: "OT", t0: 0.7, t1: 1, status: "PENDING_APPROVAL" },
      { type: "ROUTE_MARKER", t0: 0, t1: 1, status: "APPROVED" },
    ],
  });
  buildSection({
    name: "Veeyapuram → Harippad",
    from: "990103",
    to: "ROUTER",
    road: "Veeyapuram Road",
    area: "Harippad",
    daysAgo: 18,
    plan: [
      { type: "OT", t0: 0, t1: 0.7, status: "APPROVED" },
      { type: "HDD", t0: 0.7, t1: 1, status: "PENDING_APPROVAL", crossing: "Rail" },
      { type: "BLOWING", t0: 0, t1: 1, status: "APPROVED" },
    ],
    restoration: { items: 1, daysAgo: 2 },
  });
  buildSection({
    name: "Harippad → Cheruthana",
    from: "ROUTER",
    to: "990104",
    road: "SH 6",
    area: "Cheruthana",
    daysAgo: 9,
    plan: [
      { type: "HDD", t0: 0, t1: 0.15, status: "APPROVED", crossing: "Road" },
      { type: "OT", t0: 0.15, t1: 0.6, status: "IN_PROGRESS" },
      { type: "CLAMP", t0: 0.6, t1: 0.66, status: "NOT_STARTED", crossing: "Culvert" },
      { type: "OT", t0: 0.66, t1: 1, status: "NOT_STARTED" },
      { type: "CHAMBER", t0: 0, t1: 1, status: "IN_PROGRESS" },
    ],
  });
  buildSection({ name: "Cheruthana → Kumarapuram", from: "990104", to: "990105", road: "SH 6", area: "Kumarapuram", daysAgo: 4, plan: [] });
  // An older route reused as it is: no execution work, dashed on the diagrams
  // Branches off Karuvatta, so the L-14 shows a BJC there
  buildSection({ name: "Karuvatta → Thrikkunnapuzha", from: "990101", to: "990106", road: "Thrikkunnapuzha Road", area: "Thrikkunnapuzha", daysAgo: 40, plan: [], routeType: "EXISTING" });

  // ---- KML of the road route: one line per section, along the road
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Harippad demo route</name>
${sections
  .map(
    (s) =>
        `<Placemark><name>${s.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</name><LineString><tessellate>1</tessellate><coordinates>${s.roadPath.map((p) => `${p.lng},${p.lat},0`).join(" ")}</coordinates></LineString></Placemark>`
  )
  .join("\n")}
</Document></kml>`;
  const kmlSize = await writeDemoFile("demo-route.kml", kml);
  block.kmlFiles = [{ _id: oid(), name: "Harippad demo route.kml", url: url("demo-route.kml"), sizeBytes: kmlSize, uploadedAt: t(58), uploadedBy: ADMIN.id }];

  // ---- media files, then the records (validated, then inserted with their own dates)
  await runPool(mediaJobs, 4);

  const insert = async (Model, docs) => {
    if (!docs.length) return;
    const raws = [];
    for (const d of docs) {
      const doc = new Model(d);
      await doc.validate();
      const raw = doc.toObject({ virtuals: false, depopulate: true, transform: false });
      raws.push({ ...raw, createdAt: d.createdAt, updatedAt: d.updatedAt, __v: d.__v ?? 0 });
    }
    await Model.collection.insertMany(raws);
  };
  await insert(BlockProfile, [block]);
  await insert(InfraCapture, infraDocs);
  await insert(
    Section,
    sections.map(({ roadPath, ...section }) => section)
  );
  await insert(SubSection, subs);
  await insert(Trenching, entries);
  await insert(Restoration, restorations);

  return { _id: blockId, block: block.block, counts: { sections: sections.length, subsections: subs.length, entries: entries.length, media: mediaJobs.length } };
};

/** Remove every demo block and everything under it */
export const deleteDemoBlock = async () => {
  const blocks = await BlockProfile.find({ isDemo: true }).select("_id").lean();
  if (!blocks.length) return;
  const blockIds = blocks.map((b) => b._id);
  const sectionIds = await Section.find({ blockProfile: { $in: blockIds } }).distinct("_id");
  const subIds = await SubSection.find({ section: { $in: sectionIds } }).distinct("_id");
  await Promise.all([
    Trenching.deleteMany({ subSection: { $in: subIds } }),
    SubSection.deleteMany({ _id: { $in: subIds } }),
    Restoration.deleteMany({ section: { $in: sectionIds } }),
    InfraCapture.deleteMany({ blockProfile: { $in: blockIds } }),
    InfraEquipment.deleteMany({ blockProfile: { $in: blockIds } }),
  ]);
  await Section.deleteMany({ _id: { $in: sectionIds } });
  await BlockProfile.deleteMany({ _id: { $in: blockIds } });
};

import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Trenching from "../models/trenching.model.js";
import Restoration from "../models/restoration.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import { EXECUTION_TYPES, STATUS_ORDER, TYPE_ORDER, isDucting } from "../config/executionTypes.js";
import { deriveRestorationStatus } from "../services/progress.service.js";
import { blockFilter } from "../services/access.service.js";
import { sendError } from "../utils/httpError.js";

// Execution dashboard: progress of OFC execution across block profiles, in one read.
// Lengths are metres. "Planned" is the sections' route length; "laid" is the length of
// the entries recorded in ducting subsections (HDD, Open Trench, Clamping).

// Days are counted in India time, where the work happens
const TIME_ZONE = "Asia/Kolkata";
const TREND_DAYS = [7, 30, 90];
const TEAM_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const DUCTING_TYPES = TYPE_ORDER.filter(isDucting);
const RESTORATION_ORDER = ["LOCKED", "READY", "PENDING_APPROVAL", "APPROVED", "REJECTED"];

const dayKey = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

const zeroCounts = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

const round = (value, digits = 1) => {
  const f = 10 ** digits;
  return Math.round((Number(value) || 0) * f) / f;
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Places are typed by hand ("KERALA", "Kerala"), so they're compared without case
const sameName = (a, b) => String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();

const latest = (...dates) => dates.filter(Boolean).reduce((max, d) => (!max || new Date(d) > new Date(max) ? d : max), null);

// GET /api/execution-dashboard?state=&district=&blockProfile=&status=&days=30   (viewExecution)
export const getExecutionDashboard = async (req, res) => {
  try {
    const { state, district, blockProfile, status } = req.query;
    const days = TREND_DAYS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;

    // Every visible block, for the filter options; the filters then narrow the figures
    const visible = await BlockProfile.find(blockFilter(req, "viewExecution"))
      .select("state district block blockCode status isDemo numberOfGps gps.lgdCode rings updatedAt")
      .sort({ state: 1, district: 1, block: 1 })
      .lean();

    const profiles = visible.filter((p) => {
      // Deactivated blocks stay out unless asked for, as on the Blocks list
      if (!status ? p.status === "INACTIVE" : status !== "ALL" && p.status !== status) return false;
      if (state && !sameName(p.state, state)) return false;
      if (district && !sameName(p.district, district)) return false;
      if (blockProfile && String(p._id) !== String(blockProfile)) return false;
      return true;
    });
    const profileIds = profiles.map((p) => p._id);

    const [sections, captures, equipment] = await Promise.all([
      Section.find({ blockProfile: { $in: profileIds } }).select("_id blockProfile sectionLength").lean(),
      InfraCapture.find({ blockProfile: { $in: profileIds } }).select("blockProfile level gpLgdCode updatedAt").lean(),
      InfraEquipment.aggregate([
        { $match: { blockProfile: { $in: profileIds } } },
        { $group: { _id: "$form", n: { $sum: 1 } } },
      ]),
    ]);
    const sectionIds = sections.map((s) => s._id);

    const [subs, restorations] = await Promise.all([
      SubSection.find({ section: { $in: sectionIds }, typeOfWork: { $exists: true } })
        .select("section typeOfWork executionStatus subSectionLength start.at end.at approval.status approval.at createdAt updatedAt")
        .lean(),
      Restoration.find({ section: { $in: sectionIds } }).select("section status updatedAt").lean(),
    ]);
    const subIds = subs.map((s) => s._id);

    // Midnight in India time, days - 1 days ago (India has no daylight saving)
    const since = new Date(new Date(`${dayKey(new Date())}T00:00:00+05:30`).getTime() - (days - 1) * DAY_MS);
    const at = { $ifNull: ["$capturedAt", "$createdAt"] };

    const [entryRows, trendRows, teamRows] = await Promise.all([
      // Per subsection: laid length, entry count, fixes above the GPS limit, last entry
      Trenching.aggregate([
        { $match: { subSection: { $in: subIds } } },
        {
          $group: {
            _id: "$subSection",
            laidM: { $sum: "$trenchLength" },
            entries: { $sum: 1 },
            aboveLimit: { $sum: { $cond: [{ $eq: ["$accuracyAboveLimit", true] }, 1, 0] } },
            lastAt: { $max: at },
          },
        },
      ]),
      // Metres laid and entries per day in the period
      Trenching.aggregate([
        { $match: { subSection: { $in: subIds } } },
        { $addFields: { at } },
        { $match: { at: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: TIME_ZONE } },
            laidM: { $sum: { $cond: [{ $in: ["$entryType", DUCTING_TYPES] }, "$trenchLength", 0] } },
            entries: { $sum: 1 },
          },
        },
      ]),
      // Who recorded the work in the period
      Trenching.aggregate([
        { $match: { subSection: { $in: subIds } } },
        { $addFields: { at } },
        { $match: { at: { $gte: since } } },
        {
          $group: {
            _id: { $ifNull: ["$createdBy.name", "Unknown"] },
            laidM: { $sum: { $cond: [{ $in: ["$entryType", DUCTING_TYPES] }, "$trenchLength", 0] } },
            entries: { $sum: 1 },
            subs: { $addToSet: "$subSection" },
            lastAt: { $max: "$at" },
          },
        },
        { $sort: { laidM: -1, entries: -1 } },
        { $limit: TEAM_LIMIT },
      ]),
    ]);

    const entriesBySub = new Map(entryRows.map((r) => [String(r._id), r]));
    const sectionById = new Map(sections.map((s) => [String(s._id), s]));
    const restorationBySection = new Map(restorations.map((r) => [String(r.section), r]));

    // ---- per block
    const blocks = new Map(
      profiles.map((p) => [
        String(p._id),
        {
          _id: String(p._id),
          block: p.block,
          blockCode: p.blockCode,
          district: p.district || "",
          state: p.state || "",
          status: p.status,
          isDemo: Boolean(p.isDemo),
          gpsDeclared: p.numberOfGps || 0,
          gpsEntered: p.gps?.length || 0,
          gpsInfra: 0,
          infraDone: false,
          rings: p.rings?.length || 0,
          sections: 0,
          plannedM: 0,
          subPlannedM: 0,
          laidM: 0,
          approvedM: 0,
          entries: 0,
          subs: zeroCounts(STATUS_ORDER),
          subsTotal: 0,
          restorations: zeroCounts(RESTORATION_ORDER),
          lastActivityAt: null,
        },
      ])
    );

    for (const p of profiles) {
      const row = blocks.get(String(p._id));
      const gpCodes = new Set((p.gps || []).map((gp) => gp.lgdCode));
      const mine = captures.filter((c) => String(c.blockProfile) === row._id);
      row.infraDone = mine.some((c) => c.level === "BLOCK");
      row.gpsInfra = new Set(mine.filter((c) => c.level === "GP" && gpCodes.has(c.gpLgdCode)).map((c) => c.gpLgdCode)).size;
      row.lastActivityAt = latest(...mine.map((c) => c.updatedAt));
    }

    // Per section: subsection counts, for the derived restoration state
    const sectionTally = new Map(sections.map((s) => [String(s._id), { total: 0, ended: 0 }]));

    // ---- per type of work
    const byType = new Map(
      TYPE_ORDER.map((key) => [key, { typeOfWork: key, label: EXECUTION_TYPES[key].label, ducting: isDucting(key), subsections: 0, approved: 0, plannedM: 0, laidM: 0 }])
    );

    const totals = {
      subs: zeroCounts(STATUS_ORDER),
      entries: 0,
      laidM: 0,
      approvedM: 0,
      subPlannedM: 0,
      entriesAboveLimit: 0,
      planDeviation: 0,
    };
    const approvalHours = [];
    const trend = new Map();
    const bump = (date, key) => {
      if (!date || new Date(date) < since) return;
      const k = dayKey(date);
      const day = trend.get(k) || { started: 0, ended: 0, approved: 0 };
      day[key] += 1;
      trend.set(k, day);
    };

    for (const sub of subs) {
      const section = sectionById.get(String(sub.section));
      const row = section && blocks.get(String(section.blockProfile));
      if (!row) continue;
      const stats = entriesBySub.get(String(sub._id));
      const ducting = isDucting(sub.typeOfWork);
      const laid = ducting ? stats?.laidM || 0 : 0;
      const planned = ducting ? sub.subSectionLength || 0 : 0;
      const statusKey = sub.executionStatus || "NOT_STARTED";

      row.subs[statusKey] += 1;
      row.subsTotal += 1;
      row.laidM += laid;
      row.subPlannedM += planned;
      row.entries += stats?.entries || 0;
      if (statusKey === "APPROVED") row.approvedM += laid;
      row.lastActivityAt = latest(row.lastActivityAt, sub.updatedAt, stats?.lastAt);

      totals.subs[statusKey] += 1;
      totals.entries += stats?.entries || 0;
      totals.laidM += laid;
      totals.subPlannedM += planned;
      totals.entriesAboveLimit += stats?.aboveLimit || 0;
      if (statusKey === "APPROVED") totals.approvedM += laid;
      // Same rule as the approver's flag: ended ducting work more than 10% off its planned length
      if (sub.end?.at && ducting && planned > 0 && Math.abs(laid - planned) > planned * 0.1) totals.planDeviation += 1;

      const type = byType.get(sub.typeOfWork);
      if (type) {
        type.subsections += 1;
        if (statusKey === "APPROVED") type.approved += 1;
        type.plannedM += planned;
        type.laidM += laid;
      }

      const tally = sectionTally.get(String(sub.section));
      tally.total += 1;
      if (statusKey === "PENDING_APPROVAL" || statusKey === "APPROVED") tally.ended += 1;

      if (sub.approval?.status === "APPROVED" && sub.approval.at && sub.end?.at) {
        const hours = (new Date(sub.approval.at) - new Date(sub.end.at)) / 36e5;
        if (hours >= 0) approvalHours.push(hours);
      }
      bump(sub.start?.at, "started");
      bump(sub.end?.at, "ended");
      if (sub.approval?.status === "APPROVED") bump(sub.approval.at, "approved");
    }

    const restorationTotals = zeroCounts(RESTORATION_ORDER);
    for (const section of sections) {
      const row = blocks.get(String(section.blockProfile));
      row.sections += 1;
      row.plannedM += section.sectionLength || 0;
      const stored = restorationBySection.get(String(section._id));
      const state = deriveRestorationStatus(sectionTally.get(String(section._id)), stored);
      row.restorations[state] += 1;
      restorationTotals[state] += 1;
      if (stored) row.lastActivityAt = latest(row.lastActivityAt, stored.updatedAt);
    }

    // ---- per district
    const districts = new Map();
    for (const row of blocks.values()) {
      const key = `${row.state}|${row.district}`.toUpperCase();
      const d = districts.get(key) || {
        state: row.state,
        district: row.district,
        blocks: 0,
        gps: 0,
        sections: 0,
        plannedM: 0,
        laidM: 0,
        subsTotal: 0,
        subsApproved: 0,
      };
      d.blocks += 1;
      d.gps += row.gpsEntered;
      d.sections += row.sections;
      d.plannedM += row.plannedM;
      d.laidM += row.laidM;
      d.subsTotal += row.subsTotal;
      d.subsApproved += row.subs.APPROVED;
      districts.set(key, d);
    }

    // ---- daily trend, every day of the period (days without work are zero)
    const laidByDay = new Map(trendRows.map((r) => [r._id, r]));
    const trendDays = Array.from({ length: days }, (_, i) => {
      const key = dayKey(since.getTime() + i * DAY_MS);
      const laid = laidByDay.get(key);
      const counts = trend.get(key) || { started: 0, ended: 0, approved: 0 };
      return { date: key, laidM: round(laid?.laidM), entries: laid?.entries || 0, ...counts };
    });

    const equipmentCounts = Object.fromEntries(equipment.map((e) => [e._id, e.n]));
    const blockRows = [...blocks.values()].map((row) => ({
      ...row,
      plannedM: round(row.plannedM),
      subPlannedM: round(row.subPlannedM),
      laidM: round(row.laidM),
      approvedM: round(row.approvedM),
    }));

    res.json({
      generatedAt: new Date().toISOString(),
      days,
      // Options for the filter row: every visible block, whatever the filters
      options: visible.map((p) => ({ _id: String(p._id), block: p.block, district: p.district || "", state: p.state || "", status: p.status })),
      totals: {
        blocks: blockRows.length,
        blocksByStatus: blockRows.reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {}),
        gpsDeclared: blockRows.reduce((s, b) => s + b.gpsDeclared, 0),
        gpsEntered: blockRows.reduce((s, b) => s + b.gpsEntered, 0),
        gpsInfra: blockRows.reduce((s, b) => s + b.gpsInfra, 0),
        blocksInfra: blockRows.filter((b) => b.infraDone).length,
        rings: blockRows.reduce((s, b) => s + b.rings, 0),
        sections: sections.length,
        sectionsWithWork: [...sectionTally.values()].filter((t) => t.total > 0).length,
        plannedM: round(sections.reduce((s, x) => s + (x.sectionLength || 0), 0)),
        subPlannedM: round(totals.subPlannedM),
        laidM: round(totals.laidM),
        approvedM: round(totals.approvedM),
        entries: totals.entries,
        subs: totals.subs,
        subsTotal: subs.length,
        restorations: restorationTotals,
        pendingApprovals: totals.subs.PENDING_APPROVAL + restorationTotals.PENDING_APPROVAL,
        equipment: { block: equipmentCounts.block || 0, gp: equipmentCounts.gp || 0, misc: equipmentCounts.misc || 0 },
      },
      quality: {
        entriesAboveLimit: totals.entriesAboveLimit,
        rejected: totals.subs.REJECTED,
        restorationsRejected: restorationTotals.REJECTED,
        planDeviation: totals.planDeviation,
        approvalMedianHours: approvalHours.length ? round(median(approvalHours)) : null,
        approvalsMeasured: approvalHours.length,
        gpCountMismatch: blockRows.filter((b) => b.gpsDeclared !== b.gpsEntered).length,
      },
      byType: [...byType.values()]
        .filter((t) => t.subsections > 0 || t.ducting)
        .map((t) => ({ ...t, plannedM: round(t.plannedM), laidM: round(t.laidM) })),
      trend: trendDays,
      team: teamRows.map((t) => ({ name: t._id, laidM: round(t.laidM), entries: t.entries, subsections: t.subs.length, lastAt: t.lastAt })),
      districts: [...districts.values()].map((d) => ({ ...d, plannedM: round(d.plannedM), laidM: round(d.laidM) })),
      blocks: blockRows,
    });
  } catch (error) {
    sendError(res, error);
  }
};

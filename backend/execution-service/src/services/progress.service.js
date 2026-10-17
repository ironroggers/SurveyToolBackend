import mongoose from "mongoose";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Restoration from "../models/restoration.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import { ENDED_STATUSES, STATUS_ORDER } from "../config/executionTypes.js";

const toIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

// Only subsections created by the execution wizard count (legacy ones have no typeOfWork)
const EXECUTION_SUBS = { typeOfWork: { $exists: true } };

// LOCKED / READY are derived; a submitted restoration keeps its stored state
export const deriveRestorationStatus = ({ total, ended }, stored) => {
  if (stored?.status) return stored.status;
  return total > 0 && ended === total ? "READY" : "LOCKED";
};

// Per section: { counts: { NOT_STARTED: n, … }, total, ended, approved, restoration: { status, ended, total } }
export const sectionExecutionSummaries = async (sectionIds) => {
  const summaries = new Map();
  if (!sectionIds.length) return summaries;
  const ids = toIds(sectionIds);
  const [rows, restorations] = await Promise.all([
    SubSection.aggregate([
      { $match: { section: { $in: ids }, ...EXECUTION_SUBS } },
      { $group: { _id: { section: "$section", status: "$executionStatus" }, n: { $sum: 1 } } },
    ]),
    Restoration.find({ section: { $in: ids } }).select("section status").lean(),
  ]);
  for (const id of ids) {
    summaries.set(String(id), { counts: Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])), total: 0, ended: 0, approved: 0 });
  }
  for (const row of rows) {
    const summary = summaries.get(String(row._id.section));
    if (!summary || !row._id.status) continue;
    summary.counts[row._id.status] = row.n;
    summary.total += row.n;
    if (ENDED_STATUSES.includes(row._id.status)) summary.ended += row.n;
    if (row._id.status === "APPROVED") summary.approved += row.n;
  }
  const stored = new Map(restorations.map((r) => [String(r.section), r]));
  for (const [id, summary] of summaries) {
    summary.restoration = {
      status: deriveRestorationStatus(summary, stored.get(id)),
      ended: summary.ended,
      total: summary.total,
    };
  }
  return summaries;
};

// Per block profile: the three progress marks on the Blocks list
export const blockProgress = async (profiles) => {
  const progress = new Map();
  if (!profiles.length) return progress;
  const ids = profiles.map((p) => p._id);
  const [sections, captures] = await Promise.all([
    Section.find({ blockProfile: { $in: ids } }).select("_id blockProfile").lean(),
    InfraCapture.find({ blockProfile: { $in: ids } }).select("blockProfile level gpLgdCode").lean(),
  ]);
  const summaries = await sectionExecutionSummaries(sections.map((s) => s._id));

  for (const profile of profiles) {
    const key = String(profile._id);
    const own = sections.filter((s) => String(s.blockProfile) === key);
    const gpCodes = new Set((profile.gps || []).map((gp) => gp.lgdCode));
    const mine = captures.filter((c) => String(c.blockProfile) === key);
    const totals = own.reduce(
      (acc, s) => {
        const summary = summaries.get(String(s._id));
        acc.subsApproved += summary?.approved || 0;
        acc.subsTotal += summary?.total || 0;
        if (summary?.restoration.status === "APPROVED") acc.sectionsRestored += 1;
        return acc;
      },
      { subsApproved: 0, subsTotal: 0, sectionsRestored: 0 }
    );
    progress.set(key, {
      infraDone: mine.some((c) => c.level === "BLOCK"),
      gpsCaptured: new Set(mine.filter((c) => c.level === "GP" && gpCodes.has(c.gpLgdCode)).map((c) => c.gpLgdCode)).size,
      gpsTotal: gpCodes.size,
      ...totals,
      sectionsTotal: own.length,
    });
  }
  return progress;
};

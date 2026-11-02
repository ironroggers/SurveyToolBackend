import mongoose from "mongoose";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Restoration from "../models/restoration.model.js";
import Trenching from "../models/trenching.model.js";
import StageRecord from "../models/stageRecord.model.js";
import { STAGES, executionConfig, executionLimits } from "../config/executionTypes.js";
import { PERMISSIONS, normalizeRole, permissionsForRole } from "../config/permissions.js";
import { HttpError, sendError } from "../utils/httpError.js";
import { sectionExecutionSummaries } from "../services/progress.service.js";
import { entryStats, sectionContexts, subsectionFlags, subsectionSummary } from "../services/views.service.js";
import { actorRole, can, visibleSectionIds } from "../services/access.service.js";
import { REVIEW_SLOTS } from "../services/review.service.js";
import { recordLineViews } from "../services/stageViews.service.js";

// Most recent first; a long list is cut here and the counts say how many there are
const GROUP_LIMIT = 200;

// GET /api/execution/config   (any user)
export const getExecutionConfig = (req, res) => res.json(executionConfig());

// GET /api/permissions?role=   (any user) — the whole matrix without a role
export const getPermissions = (req, res) => {
  const { role } = req.query;
  if (role) return res.json({ role: normalizeRole(role), actions: permissionsForRole(role) });
  res.json({ matrix: PERMISSIONS });
};

// { section: { $in: ids } } for the user's blocks, or {} when they see every block
const visibleSections = async (req) => {
  const ids = await visibleSectionIds(req);
  return ids ? { section: { $in: ids } } : {};
};

const summarise = async (subs) => {
  const [stats, contexts] = await Promise.all([
    entryStats(subs.map((s) => s._id)),
    sectionContexts([...new Set(subs.map((s) => String(s.section)))]),
  ]);
  return subs.map((s) => subsectionSummary(s, stats.get(String(s._id)), contexts.get(String(s.section))));
};

// A stage record on My work or in the approvals queue
const stageRecordCards = async (records) => {
  const contexts = await sectionContexts([...new Set(records.map((r) => String(r.section)))]);
  const lines = await recordLineViews(records);
  const { accuracyLimitM } = executionLimits();
  return records.map((r) => ({
    ...lines.get(String(r._id)),
    kind: "stageRecord",
    _id: r._id,
    name: r.name,
    stage: r.stage,
    stageLabel: STAGES[r.stage].label,
    status: r.status,
    ...contexts.get(String(r.section)),
    remark: r.status === "REJECTED" ? r.approval?.remark : undefined,
    review: r.review || {},
    submittedAt: r.submittedAt,
    submittedBy: r.submittedBy,
    updatedAt: r.updatedAt,
    flags: {
      mediaAboveLimit: (r.photos || []).filter((m) => m.accuracyAboveLimit || (m.locationSource === "GPS" && m.accuracy > accuracyLimitM)).length,
      gpsAboveLimit: r.accuracyAboveLimit ? 1 : 0,
      uploaded: (r.photos || []).filter((m) => m.source === "UPLOAD").length,
      locationTyped: (r.photos || []).filter((m) => m.locationSource === "MANUAL").length,
    },
  }));
};

const restorationCards = async (restorations, extra = () => ({})) => {
  const contexts = await sectionContexts(restorations.map((r) => String(r.section)));
  return restorations.map((r) => ({
    kind: "restoration",
    ...contexts.get(String(r.section)),
    status: r.status,
    remark: r.status === "REJECTED" ? r.approval?.remark : undefined,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    ...extra(r),
  }));
};

// GET /api/my-work   (viewExecution) — the work in the blocks the user may see
export const getMyWork = async (req, res) => {
  try {
    const notHidden = await visibleSections(req);
    const subsWith = (executionStatus) =>
      SubSection.find({ executionStatus, ...notHidden }).sort({ updatedAt: -1 }).limit(GROUP_LIMIT);
    const [rejected, inProgress, pending, restorations, sectionIds, rejectedRecords] = await Promise.all([
      subsWith("REJECTED"),
      subsWith("IN_PROGRESS"),
      subsWith("PENDING_APPROVAL"),
      Restoration.find({ status: { $in: ["REJECTED", "PENDING_APPROVAL"] }, ...notHidden }).sort({ updatedAt: -1 }).lean(),
      SubSection.distinct("section", { typeOfWork: { $exists: true }, ...notHidden }),
      StageRecord.find({ status: "REJECTED", ...notHidden }).sort({ updatedAt: -1 }).limit(GROUP_LIMIT).lean(),
    ]);

    // Sections whose subsections have all ended and whose restoration isn't submitted yet
    const summaries = await sectionExecutionSummaries(sectionIds);
    const readyIds = [...summaries].filter(([, s]) => s.restoration.status === "READY").map(([id]) => id);
    const readyContexts = await sectionContexts(readyIds);

    const [rejectedCards, inProgressCards, pendingCards, restorationList, recordCards] = await Promise.all([
      summarise(rejected),
      summarise(inProgress),
      summarise(pending),
      restorationCards(restorations),
      stageRecordCards(rejectedRecords),
    ]);
    const subCards = (cards) => cards.map((c) => ({ kind: "subsection", ...c }));
    const needsFix = [...subCards(rejectedCards), ...recordCards, ...restorationList.filter((r) => r.status === "REJECTED")];

    res.json({
      needsFix,
      inProgress: subCards(inProgressCards),
      readyForRestoration: readyIds.map((id) => ({
        kind: "restoration",
        ...readyContexts.get(id),
        status: "READY",
        total: summaries.get(id).total,
      })),
      waitingApproval: [...subCards(pendingCards), ...restorationList.filter((r) => r.status === "PENDING_APPROVAL")],
      counts: { needsFix: needsFix.length },
    });
  } catch (error) {
    sendError(res, error);
  }
};

// The section stage each section reviewer acts on
const SECTION_REVIEW_STAGE = { "ZONAL MANAGER": "ZONAL", ADMIN: "ADMIN" };

// GET /api/approvals?kind=&district=&blockProfile=&typeOfWork=&stage=
// What's waiting for this user: subsections and stage records (Cluster Head, GIS Head: the ones
// they haven't approved yet), sections (Zonal Manager at ZONAL, Admin at ADMIN) and restorations (Admin).
export const getApprovals = async (req, res) => {
  try {
    const slot = REVIEW_SLOTS[actorRole(req)];
    const sectionStage = can(req, "reviewSection") ? SECTION_REVIEW_STAGE[actorRole(req)] : null;
    const reviewsSubs = can(req, "reviewSubsection") && slot;
    const approvesRestoration = can(req, "approveRestoration");
    if (!reviewsSubs && !sectionStage && !approvesRestoration) throw new HttpError(403, "You don't review anything", { code: "FORBIDDEN" });

    const { kind, district, blockProfile, typeOfWork, stage: recordStage } = req.query;
    const sectionFilter = { blockProfile: { $exists: true } };
    const visible = await visibleSectionIds(req, "viewExecution");
    if (visible) sectionFilter._id = { $in: visible };
    if (blockProfile && mongoose.isValidObjectId(blockProfile)) sectionFilter.blockProfile = blockProfile;
    if (district) sectionFilter.district = district;
    const sectionIds = (await Section.find(sectionFilter).select("_id").lean()).map((s) => s._id);

    let subsections = [];
    if (reviewsSubs && (!kind || kind === "subsection")) {
      const filter = { section: { $in: sectionIds }, executionStatus: "PENDING_APPROVAL", [`review.${slot}.status`]: { $ne: "APPROVED" } };
      if (typeOfWork) filter.typeOfWork = typeOfWork;
      // Oldest submission first
      const subs = await SubSection.find(filter).sort({ "end.at": 1 }).limit(GROUP_LIMIT);
      const entries = await Trenching.find({ subSection: { $in: subs.map((s) => s._id) } })
        .select("subSection trenchLength accuracyAboveLimit mediaFiles")
        .lean();
      const cards = await summarise(subs);
      subsections = cards.map((card, i) => {
        const own = entries.filter((e) => String(e.subSection) === String(subs[i]._id));
        return { kind: "subsection", ...card, submittedBy: subs[i].end?.by, flags: subsectionFlags(subs[i], own, card.doneM) };
      });
    }

    let stageRecords = [];
    if (reviewsSubs && (!kind || kind === "stageRecord")) {
      const filter = { section: { $in: sectionIds }, status: "PENDING_APPROVAL", [`review.${slot}.status`]: { $ne: "APPROVED" } };
      if (recordStage) filter.stage = recordStage;
      stageRecords = await stageRecordCards(await StageRecord.find(filter).sort({ submittedAt: 1 }).limit(GROUP_LIMIT).lean());
    }

    let sections = [];
    if (sectionStage && (!kind || kind === "section")) {
      const waiting = await Section.find({ _id: { $in: sectionIds }, "review.stage": sectionStage })
        .select("name blockProfile sectionLength review.history review.zonal")
        .lean();
      const [contexts, summaries] = await Promise.all([
        sectionContexts(waiting.map((s) => String(s._id))),
        sectionExecutionSummaries(waiting.map((s) => s._id)),
      ]);
      sections = waiting
        .map((s) => ({
          kind: "section",
          ...contexts.get(String(s._id)),
          stage: sectionStage,
          sectionLength: s.sectionLength,
          subsectionCount: summaries.get(String(s._id))?.total || 0,
          // When it reached this stage
          submittedAt: [...(s.review?.history || [])].reverse().find((h) => h.type === "forwarded" || h.type === "approved")?.at,
          zonal: s.review?.zonal,
        }))
        .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    }

    let restorations = [];
    if (approvesRestoration && (!kind || kind === "restoration")) {
      const pending = await Restoration.find({ section: { $in: sectionIds }, status: "PENDING_APPROVAL" })
        .sort({ submittedAt: 1 })
        .lean();
      const summaries = await sectionExecutionSummaries(pending.map((r) => r.section));
      const { accuracyLimitM } = executionLimits();
      restorations = await restorationCards(pending, (r) => {
        const summary = summaries.get(String(r.section));
        const media = r.items.flatMap((it) => [...(it.photos || []), it.video].filter(Boolean));
        return {
          itemCount: r.items.length,
          submittedBy: r.submittedBy,
          totalSubs: summary?.total || 0,
          approvedSubs: summary?.approved || 0,
          approveBlocked: (summary?.approved || 0) < (summary?.total || 0),
          flags: {
            mediaAboveLimit: media.filter((m) => m.accuracyAboveLimit || (m.locationSource === "GPS" && m.accuracy > accuracyLimitM)).length,
            uploaded: media.filter((m) => m.source === "UPLOAD").length,
            locationTyped: media.filter((m) => m.locationSource === "MANUAL").length,
          },
        };
      });
    }

    res.json({
      subsections,
      stageRecords,
      sections,
      restorations,
      counts: {
        subsections: subsections.length,
        stageRecords: stageRecords.length,
        sections: sections.length,
        restorations: restorations.length,
        total: subsections.length + stageRecords.length + sections.length + restorations.length,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
};

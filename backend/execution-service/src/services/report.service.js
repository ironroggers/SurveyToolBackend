import mongoose from "mongoose";
import XLSX from "xlsx";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import Trenching from "../models/trenching.model.js";
import Restoration from "../models/restoration.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import InfraEquipment from "../models/infraEquipment.model.js";
import Report, { REPORT_LEVELS } from "../models/report.model.js";
import { badRequest, HttpError, notFound } from "../utils/httpError.js";
import { getS3Bucket, uploadBuffer } from "../utils/s3.js";
import { sectionExecutionSummaries } from "./progress.service.js";
import { sectionReportView } from "./stageViews.service.js";
import { pitKey } from "./stagePits.service.js";
import { REPORT_LEVEL_LABELS, sheetsFor, when } from "./reportSheets.js";

// Builds an Excel report for one block, section or subsection from the sheets and columns the
// Admin picked (reportSheets.js), stores it in S3 and records it as a Report.

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const isId = (id) => mongoose.isValidObjectId(id);

// ---- what the request asks for

/**
 * The block, section and subsection the report is about, checked against each other:
 * { level, profile, section, sub }. Throws 400 / 404 on a bad choice.
 */
export const resolveTarget = async ({ level, blockProfile, section, subSection }, loadProfile) => {
  if (!REPORT_LEVELS.includes(level)) throw badRequest("Pick Block, Section or Subsection");
  if (!isId(blockProfile)) throw badRequest("Pick a block");
  const profile = await loadProfile(blockProfile);
  if (level === "BLOCK") return { level, profile };

  if (!isId(section)) throw badRequest("Pick a section");
  const sectionDoc = await Section.findOne({ _id: section, blockProfile: profile._id }).lean();
  if (!sectionDoc) throw notFound("That section isn't in this block");
  if (level === "SECTION") return { level, profile, section: sectionDoc };

  if (!isId(subSection)) throw badRequest("Pick a subsection");
  const sub = await SubSection.findOne({ _id: subSection, section: sectionDoc._id }).select("_id name").lean();
  if (!sub) throw notFound("That subsection isn't in this section");
  return { level, profile, section: sectionDoc, sub };
};

/** The picked sheets and columns, in catalog order: [{ sheet, columns }]. Unknown keys are a 400. */
export const resolveSheets = (level, picked) => {
  if (!Array.isArray(picked) || !picked.length) throw badRequest("Pick at least one sheet");
  const offered = sheetsFor(level);
  const byKey = new Map(picked.map((p) => [String(p?.key), p]));
  const unknown = [...byKey.keys()].filter((key) => !offered.some((s) => s.key === key));
  if (unknown.length) throw badRequest(`Not offered for a ${REPORT_LEVEL_LABELS[level].toLowerCase()} report: ${unknown.join(", ")}`);
  return offered
    .filter((sheet) => byKey.has(sheet.key))
    .map((sheet) => {
      const wanted = byKey.get(sheet.key).columns;
      // No column list means every column
      const keys = Array.isArray(wanted) ? new Set(wanted.map(String)) : null;
      const columns = keys ? sheet.columns.filter((c) => keys.has(c.key)) : sheet.columns;
      if (!columns.length) throw badRequest(`Pick at least one column for ${sheet.label}`);
      return { sheet, columns };
    });
};

// ---- the data, read once per report

export const buildReportContext = async ({ level, profile, section, sub }) => {
  const allSections = await Section.find({ blockProfile: profile._id }).sort({ name: 1, _id: 1 }).lean();
  const sections = level === "BLOCK" ? allSections : [section];
  const sectionIds = sections.map((s) => s._id);
  const order = new Map(sections.map((s, i) => [String(s._id), i]));
  const sectionName = (id) => sections.find((s) => String(s._id) === String(id))?.name || "";

  const subDocs = await SubSection.find(level === "SUBSECTION" ? { _id: sub._id } : { section: { $in: sectionIds }, typeOfWork: { $exists: true } });
  const subs = subDocs
    .map((doc) => ({ ...doc.toObject({ virtuals: true }), sectionName: sectionName(doc.section) }))
    .sort((a, b) => order.get(String(a.section)) - order.get(String(b.section)) || (a.seq ?? Infinity) - (b.seq ?? Infinity) || String(a._id).localeCompare(String(b._id)));

  const [entries, restorations, summaries, allSubCount, infra, equipment] = await Promise.all([
    Trenching.find({ subSection: { $in: subs.map((s) => s._id) } }).sort({ capturedAt: 1, _id: 1 }).lean(),
    Restoration.find({ section: { $in: sectionIds } }).lean(),
    sectionExecutionSummaries(sectionIds),
    SubSection.countDocuments({ section: { $in: allSections.map((s) => s._id) }, typeOfWork: { $exists: true } }),
    level === "BLOCK" ? InfraCapture.find({ blockProfile: profile._id }).sort({ level: 1, gpLgdCode: 1 }).lean() : [],
    level === "BLOCK" ? InfraEquipment.find({ blockProfile: profile._id }).sort({ form: 1, gpLgdCode: 1 }).lean() : [],
  ]);

  // One stage context per section; sequential so a big block doesn't open many reads at once
  const views = new Map();
  for (const s of sections) views.set(String(s._id), await sectionReportView(s, profile));
  const view = (s) => views.get(String(s._id));

  const sectionRecords = new Map(
    sections.map((s) => [String(s._id), view(s).records.map((r) => ({ ...r, sectionName: s.name }))])
  );
  let records = [...sectionRecords.values()].flat();
  if (level === "SUBSECTION") {
    // Its duct run, and the couplings at its pits
    const pits = view(section).pits;
    const pitKeys = new Set(["start", "end"].flatMap((side) => pits.byKey.get(pitKey(sub._id, side))?.keys || []));
    records = records.filter(
      (r) => (r.stage === "DUCTING" && String(r.links?.subSection) === String(sub._id)) || (r.stage === "COUPLING" && pitKeys.has(r.data?.pit))
    );
  }

  const entriesBySub = new Map();
  for (const e of entries) entriesBySub.set(String(e.subSection), [...(entriesBySub.get(String(e.subSection)) || []), e]);
  const entriesOf = (s) => entriesBySub.get(String(s._id)) || [];
  const restorationById = new Map(restorations.map((r) => [String(r.section), r]));

  return {
    level,
    profile,
    sections,
    subs,
    records,
    infra,
    equipment,
    allSectionCount: allSections.length,
    allSubCount,
    view,
    recordsOf: (s) => sectionRecords.get(String(s._id)) || [],
    subsOf: (s) => subs.filter((x) => String(x.section) === String(s._id)),
    entriesOf,
    doneM: (s) => entriesOf(s).reduce((total, e) => total + (Number(e.trenchLength) || 0), 0),
    restorationOf: (sectionId) => restorationById.get(String(sectionId)),
    restorationStatus: (s) => summaries.get(String(s._id))?.restoration?.status,
  };
};

// ---- the workbook

const MAX_CELL = 32767;
const clean = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.length > MAX_CELL ? value.slice(0, MAX_CELL) : value;
  return value;
};

const widthOf = (rows, index) => Math.min(60, Math.max(8, ...rows.map((row) => String(row[index] ?? "").length)) + 2);

const toSheet = (rows, { filter }) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = rows[0].map((_, i) => ({ wch: widthOf(rows, i) }));
  if (filter && rows.length > 1) ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
};

const titleOf = ({ profile, section, sub }) => [profile.block, section?.name, sub?.name].filter(Boolean).join(" › ");

const slug = (text) =>
  String(text || "")
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const fileNameOf = (target, at) => {
  const stamp = when(at).replace(/[-: ]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  return `${[slug(target.profile.block), slug(target.section?.name), slug(target.sub?.name), "report", stamp].filter(Boolean).join("_")}.xlsx`;
};

/** { buffer, sheets: [{ key, label, columns, rows }] } */
export const buildWorkbook = (rc, chosen, { title, actor, at }) => {
  const wb = XLSX.utils.book_new();
  const about = [
    ["Report", title],
    ["Level", REPORT_LEVEL_LABELS[rc.level]],
    ["State", rc.profile.state || ""],
    ["District", rc.profile.district || ""],
    ["Block", rc.profile.block || ""],
    ...(rc.level !== "BLOCK" ? [["Section", rc.sections[0]?.name || ""]] : []),
    ...(rc.level === "SUBSECTION" ? [["Subsection", rc.subs[0]?.name || ""]] : []),
    ["Generated at", when(at)],
    ["Generated by", actor?.name || ""],
    ["Sheets", chosen.map((c) => c.sheet.label).join(", ")],
  ];
  XLSX.utils.book_append_sheet(wb, toSheet(about, { filter: false }), "About");

  const sheets = chosen.map(({ sheet, columns }) => {
    const items = sheet.rows(rc);
    const single = sheet.single?.includes(rc.level) && items.length === 1;
    const rows = single
      ? [["Field", "Value"], ...columns.map((c) => [c.label, clean(c.get(items[0], rc))])]
      : [columns.map((c) => c.label), ...items.map((item) => columns.map((c) => clean(c.get(item, rc))))];
    XLSX.utils.book_append_sheet(wb, toSheet(rows, { filter: !single }), sheet.label.slice(0, 31));
    return { key: sheet.key, label: sheet.label, columns: columns.map((c) => c.key), rows: items.length };
  });

  return { buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }), sheets };
};

// ---- generate and store

export const generateReport = async (target, picked, actor) => {
  const chosen = resolveSheets(target.level, picked);
  if (!getS3Bucket()) throw new HttpError(500, "Report storage isn't configured on the execution service (S3_BUCKET)");
  const at = new Date();
  const title = titleOf(target);
  const rc = await buildReportContext(target);
  const { buffer, sheets } = buildWorkbook(rc, chosen, { title, actor, at });

  const _id = new mongoose.Types.ObjectId();
  const s3Key = `reports/${target.profile.blockCode || target.profile._id}/${_id}.xlsx`;
  const sizeBytes = await uploadBuffer(s3Key, buffer, XLSX_TYPE);
  return Report.create({
    _id,
    level: target.level,
    blockProfile: target.profile._id,
    section: target.section?._id,
    subSection: target.sub?._id,
    title,
    names: { block: target.profile.block, district: target.profile.district, section: target.section?.name, subSection: target.sub?.name },
    sheets,
    fileName: fileNameOf(target, at),
    s3Key,
    sizeBytes,
    createdBy: actor,
  });
};

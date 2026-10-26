// Loads the LGD master (state, district, block and GP names and codes) from the GP list Excel.
//
//   node scripts/importLgdMaster.js <file.xlsx>           dry run: prints what would change
//   node scripts/importLgdMaster.js <file.xlsx> --apply   writes the changes
//
// The sheet named "Format" (else the first) with the columns: State Name, State Code,
// District Name, District Code, Block Name, Block Code, GP Name, GP Code, Remarks.
//   - GPs converted into a municipality (that remark, or a code that isn't 6 digits) are left out
//   - one LgdBlock per block code; a block already loaded gets its names and GP list replaced
// Safe to run again with an updated file. Block profiles already created are not changed.
import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";
import LgdBlock from "../src/models/lgdBlock.model.js";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";

const COLUMNS = {
  state: "state name",
  stateCode: "state code",
  district: "district name",
  districtCode: "district code",
  block: "block name",
  blockCode: "block code",
  gp: "gp name",
  gpCode: "gp code",
  remarks: "remarks",
};
// LGD codes have a fixed number of digits; Excel drops leading zeros
const DIGITS = { stateCode: 2, districtCode: 3, blockCode: 4, gpCode: 6 };

const text = (v) => String(v ?? "").trim();
const code = (v, key) => {
  const s = text(v);
  return /^\d+$/.test(s) ? s.padStart(DIGITS[key], "0") : s;
};

const readBlocks = (file) => {
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets.Format || wb.Sheets[wb.SheetNames[0]];
  const [header, ...rows] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, name]) => [key, header.findIndex((h) => text(h).toLowerCase() === name)])
  );
  const missing = Object.entries(col).filter(([key, i]) => i < 0 && key !== "remarks").map(([key]) => COLUMNS[key]);
  if (missing.length) throw new Error(`Columns not found: ${missing.join(", ")}`);

  const blocks = new Map();
  const skipped = [];
  for (const row of rows) {
    const get = (key) => (col[key] < 0 ? "" : row[col[key]]);
    if (!text(get("gp")) && !text(get("blockCode"))) continue;
    const gpCode = code(get("gpCode"), "gpCode");
    const remark = text(get("remarks"));
    const blockCode = code(get("blockCode"), "blockCode");
    if (/municipal/i.test(remark) || !/^\d{6}$/.test(gpCode)) {
      skipped.push(`${text(get("block"))} / ${text(get("gp"))} (${gpCode})${remark ? `: ${remark}` : ""}`);
      continue;
    }
    if (!/^\d{4}$/.test(blockCode)) throw new Error(`Block code ${blockCode} of ${text(get("block"))} isn't 4 digits`);
    if (!blocks.has(blockCode)) {
      blocks.set(blockCode, {
        state: text(get("state")),
        stateCode: code(get("stateCode"), "stateCode"),
        district: text(get("district")),
        districtCode: code(get("districtCode"), "districtCode"),
        block: text(get("block")),
        blockCode,
        gps: [],
      });
    }
    blocks.get(blockCode).gps.push({ name: text(get("gp")), lgdCode: gpCode });
  }
  return { blocks: [...blocks.values()], skipped };
};

const run = async () => {
  if (!FILE) throw new Error("Give the Excel file: node scripts/importLgdMaster.js <file.xlsx> [--apply]");
  const { blocks, skipped } = readBlocks(FILE);
  const gpCount = blocks.reduce((n, b) => n + b.gps.length, 0);
  console.log(`${blocks.length} blocks, ${gpCount} GPs in ${new Set(blocks.map((b) => b.district)).size} districts`);
  console.log(`${skipped.length} GP(s) left out:`);
  skipped.forEach((s) => console.log(`  ${s}`));

  await mongoose.connect(MONGODB_URI);
  const existing = new Set(await LgdBlock.distinct("blockCode"));
  console.log(`${blocks.filter((b) => !existing.has(b.blockCode)).length} new, ${blocks.filter((b) => existing.has(b.blockCode)).length} updated`);
  if (!APPLY) {
    console.log("Dry run; add --apply to write");
  } else {
    const result = await LgdBlock.bulkWrite(
      blocks.map((b) => ({ updateOne: { filter: { blockCode: b.blockCode }, update: { $set: b }, upsert: true } }))
    );
    console.log(`Wrote ${result.upsertedCount} new and ${result.modifiedCount} changed block(s)`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

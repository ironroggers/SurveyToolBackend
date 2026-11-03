// Creates the block profiles and their sections from the GP infra and section-wise Excel files,
// with names and codes from the LGD master (scripts/importLgdMaster.js loads it first).
//
//   node scripts/importBlockProfiles.js --gps <GP infra.xlsx> --sections <Section wise.xlsx> --routers <Block infra.xlsx>           dry run
//   node scripts/importBlockProfiles.js --gps <GP infra.xlsx> --sections <Section wise.xlsx> --routers <Block infra.xlsx> --apply   writes
//
// GP infra (first sheet): District Name, Block Name, GP Name, LGD Code, Lat, Long.
// Section wise ("Sheet1", header on row 2): Zone Name, District name, Block Name, Segment Name, From,
// To, and the lengths in km: A usable incremental, B new 24F, C new common 24F, D shared 24F, F total.
// Block infra (first sheet): District, Block Name, Block Router Location, Lat, Long.
//   - the location text is the router's name; a point given for more than one block is a
//     placeholder, so those routers are left without coordinates
//   - blocks are matched to the master by name, GPs by LGD code (names come from the master)
//   - a section end is the block router ("… BLOCK ROUTER"), a GP by name ("X GP", "X GP BJC1" and
//     "X BJC" are GP X), else a BJC of the block, numbered BJC01, BJC02, … in the order met
//   - lengths are stored in metres: existing incremental = A, main = B + C, sharing = D; the
//     section length is their sum. The four km values as given are kept in section.others.
//   - a block that already has a profile is skipped with its sections
import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";
import LgdBlock from "../src/models/lgdBlock.model.js";
import BlockProfile from "../src/models/blockProfile.model.js";
import Section from "../src/models/section.model.js";
import { findBlockNode, formatLatLong } from "../src/utils/blockNodes.js";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const GPS_FILE = arg("--gps");
const SECTIONS_FILE = arg("--sections");
const ROUTERS_FILE = arg("--routers");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";

const text = (v) => String(v ?? "").trim();
const key = (v) => text(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
// "X GP", "X GP BJC1" and "X BJC" all name GP X
const gpKey = (v) => key(v).replace(/(GP)?(BJC\d*)?$/, "");
const isRouter = (v) => /ROUTER/i.test(text(v));
// "10.040788°" and "*4.556" are numbers too
const number = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(text(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const metres = (km) => Math.round((km || 0) * 1000 * 100) / 100;

const rowsOf = (file, sheetName, headerRow) => {
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const header = rows[headerRow].map((h) => text(h).toLowerCase());
  const col = (start) => {
    const i = header.findIndex((h) => h.startsWith(start));
    if (i < 0) throw new Error(`${file}: no column starting "${start}"`);
    return i;
  };
  return { col, rows: rows.slice(headerRow + 1) };
};

const readGps = (file) => {
  const { col, rows } = rowsOf(file, null, 0);
  const c = { block: col("block name"), gp: col("gp name"), code: col("lgd code"), lat: col("lat"), lng: col("long") };
  return rows
    .filter((r) => text(r[c.gp]))
    .map((r) => ({ block: text(r[c.block]), gp: text(r[c.gp]), lgdCode: text(r[c.code]), latitude: number(r[c.lat]), longitude: number(r[c.lng]) }));
};

const readRouters = (file) => {
  const { col, rows } = rowsOf(file, null, 0);
  const c = { block: col("block name"), name: col("block router location"), lat: col("lat"), lng: col("long") };
  return rows
    .filter((r) => text(r[c.block]))
    .map((r) => ({ block: text(r[c.block]), name: text(r[c.name]).replace(/\s+/g, " "), latitude: number(r[c.lat]), longitude: number(r[c.lng]) }));
};

const readSections = (file) => {
  const { col, rows } = rowsOf(file, "Sheet1", 1);
  const c = {
    zone: col("zone"),
    block: col("block name"),
    name: col("segment name"),
    from: col("from"),
    to: col("to"),
    a: col("usable incremental"),
    b: col("new route length 24f"),
    c: col("new route length common"),
    d: col("shared 24f"),
    f: col("total section length"),
    range: col("range"),
  };
  return rows
    .filter((r) => text(r[c.name]))
    .map((r) => ({
      zone: text(r[c.zone]),
      block: text(r[c.block]),
      name: text(r[c.name]),
      from: text(r[c.from]),
      to: text(r[c.to]),
      km: { a: number(r[c.a]) || 0, b: number(r[c.b]) || 0, c: number(r[c.c]) || 0, d: number(r[c.d]) || 0, f: number(r[c.f]) || 0 },
      raw: { d: r[c.d] },
      range: text(r[c.range]),
    }));
};

const run = async () => {
  if (!GPS_FILE || !SECTIONS_FILE || !ROUTERS_FILE) {
    throw new Error("Give the three files: --gps <GP infra.xlsx> --sections <Section wise.xlsx> --routers <Block infra.xlsx> [--apply]");
  }
  const gpRows = readGps(GPS_FILE);
  const routerRows = readRouters(ROUTERS_FILE);
  const sectionRows = readSections(SECTIONS_FILE);

  await mongoose.connect(MONGODB_URI);
  const master = await LgdBlock.find().lean();
  const existing = new Set(await BlockProfile.distinct("blockCode"));
  const byName = new Map(master.map((b) => [key(b.block), b]));
  const problems = [];
  const notes = [];

  const blockOf = (name, where) => {
    const b = byName.get(key(name));
    if (!b) problems.push(`${where}: block "${name}" isn't in the master`);
    return b;
  };

  // GP coordinates by LGD code
  const gpPoint = new Map();
  for (const r of gpRows) {
    const b = blockOf(r.block, `GP ${r.gp}`);
    if (!b) continue;
    if (!b.gps.some((g) => g.lgdCode === r.lgdCode)) problems.push(`GP ${r.gp} (${r.lgdCode}) isn't under ${b.block} in the master`);
    gpPoint.set(r.lgdCode, r);
  }

  // Router by block; a point given for several blocks is dropped
  const pointKey = (r) => `${r.latitude},${r.longitude}`;
  const pointUses = new Map();
  for (const r of routerRows) pointUses.set(pointKey(r), (pointUses.get(pointKey(r)) || 0) + 1);
  const routerOf = new Map();
  for (const r of routerRows) {
    const b = blockOf(r.block, `Router ${r.name}`);
    if (!b) continue;
    const shared = pointUses.get(pointKey(r)) > 1;
    if (shared) notes.push(`${b.block}: router point ${pointKey(r)} is given for ${pointUses.get(pointKey(r))} blocks, left blank`);
    routerOf.set(b.blockCode, { name: r.name, ...(!shared && { latitude: r.latitude, longitude: r.longitude }) });
  }

  const plans = [];
  for (const b of master.sort((x, y) => x.district.localeCompare(y.district) || x.block.localeCompare(y.block))) {
    const rows = sectionRows.filter((r) => key(r.block) === key(b.block));
    const gpByName = new Map();
    for (const g of b.gps) gpByName.set(gpKey(g.name), g);
    for (const r of gpRows) if (key(r.block) === key(b.block)) gpByName.set(gpKey(r.gp), b.gps.find((g) => g.lgdCode === r.lgdCode));

    const bjcs = [];
    const endOf = (name, section) => {
      if (isRouter(name)) {
        return { type: "ROUTER", code: b.blockCode };
      }
      const gp = gpByName.get(gpKey(name));
      if (gp) {
        if (/BJC/i.test(name)) notes.push(`${b.block} / ${section}: "${name}" taken as GP ${gp.name}`);
        return { type: "GP", code: gp.lgdCode };
      }
      if (/BJC/i.test(name)) {
        const code = `BJC${String(bjcs.length + 1).padStart(2, "0")}`;
        bjcs.push({ name, code });
        return { type: "BJC", code };
      }
      problems.push(`${b.block} / ${section}: "${name}" is not the router, a GP or a BJC`);
      return null;
    };

    const sections = rows.map((r) => {
      const { a, b: newKm, c, d, f } = r.km;
      if (Math.abs(a + newKm + c + d - f) > 0.002) notes.push(`${b.block} / ${r.name}: total ${f} km, parts add up to ${Math.round((a + newKm + c + d) * 1000) / 1000} km (parts used)`);
      if (typeof r.raw.d === "string" && r.raw.d.trim()) notes.push(`${b.block} / ${r.name}: shared length "${r.raw.d}" read as ${d} km`);
      return {
        name: r.name,
        fromNode: endOf(r.from, r.name),
        toNode: endOf(r.to, r.name),
        existingIncrementalPathLength: metres(a),
        mainPathLength: metres(newKm + c),
        sharingPathLength: metres(d),
        others: { zone: r.zone, range: r.range, usableIncrementalKm: a, newKm, newCommonKm: c, sharedKm: d, totalKm: f },
      };
    });
    if (!rows.length) problems.push(`${b.block}: no sections in the file`);
    if (!routerOf.has(b.blockCode)) problems.push(`${b.block}: no row in the router file`);

    plans.push({
      skip: existing.has(b.blockCode),
      profile: {
        state: b.state,
        stateCode: b.stateCode,
        district: b.district,
        districtCode: b.districtCode,
        block: b.block,
        blockCode: b.blockCode,
        numberOfGps: b.gps.length,
        gps: b.gps.map((g) => {
          const p = gpPoint.get(g.lgdCode);
          if (!p) problems.push(`${b.block}: GP ${g.name} (${g.lgdCode}) has no row in the GP file`);
          return { name: g.name, lgdCode: g.lgdCode, latitude: p?.latitude ?? undefined, longitude: p?.longitude ?? undefined };
        }),
        bjcs,
        blockRouter: routerOf.get(b.blockCode) || {},
      },
      sections,
    });
  }

  const toCreate = plans.filter((p) => !p.skip);
  const count = (list, f) => list.reduce((n, p) => n + f(p), 0);
  console.log(`Master: ${master.length} blocks. Files: ${gpRows.length} GP rows, ${sectionRows.length} section rows, ${routerRows.length} router rows.`);
  console.log(`To create: ${toCreate.length} block profiles, ${count(toCreate, (p) => p.profile.gps.length)} GPs, ${count(toCreate, (p) => p.profile.bjcs.length)} BJCs, ${count(toCreate, (p) => p.sections.length)} sections`);
  const skipped = plans.filter((p) => p.skip);
  console.log(`Routers with coordinates: ${toCreate.filter((p) => p.profile.blockRouter.latitude != null).length} of ${toCreate.length}`);
  if (skipped.length) console.log(`Skipped (already have a profile): ${skipped.map((p) => p.profile.block).join(", ")}`);
  console.log(`Total section length: ${Math.round(count(toCreate, (p) => p.sections.reduce((n, s) => n + s.existingIncrementalPathLength + s.mainPathLength + s.sharingPathLength, 0)) / 10) / 100} km`);
  if (notes.length) {
    console.log(`Notes (${notes.length}):`);
    notes.forEach((n) => console.log(`  ${n}`));
  }
  if (problems.length) {
    console.log(`Problems (${problems.length}), nothing written:`);
    problems.forEach((p) => console.log(`  ${p}`));
  }

  // Every profile and section is validated before anything is written
  const docs = toCreate.map((p) => ({ plan: p, profile: new BlockProfile({ ...p.profile, status: "ACTIVE" }) }));
  const invalid = [];
  for (const { plan, profile } of docs) {
    await profile.validate().catch((e) => invalid.push(`${plan.profile.block}: ${e.message}`));
    for (const s of plan.sections) {
      const from = s.fromNode && findBlockNode(profile, s.fromNode);
      const to = s.toNode && findBlockNode(profile, s.toNode);
      if (!from || !to) continue;
      Object.assign(s, {
        state: profile.state,
        stateCode: profile.stateCode,
        district: profile.district,
        districtCode: profile.districtCode,
        block: profile.block,
        blockCode: profile.blockCode,
        blockProfile: profile._id,
        fromNode: { type: from.type, code: from.code, name: from.name },
        toNode: { type: to.type, code: to.code, name: to.name },
        fromLatLong: formatLatLong(from),
        toLatLong: formatLatLong(to),
        sectionLength: Math.round((s.existingIncrementalPathLength + s.mainPathLength + s.sharingPathLength) * 100) / 100,
        routeType: "NEW",
        review: { stage: "FIELD", history: [] },
      });
      await new Section(s).validate().catch((e) => invalid.push(`${plan.profile.block} / ${s.name}: ${e.message}`));
    }
  }
  if (invalid.length) {
    console.log(`Invalid (${invalid.length}), nothing written:`);
    invalid.forEach((m) => console.log(`  ${m}`));
  }

  if (!APPLY) {
    console.log("Dry run; add --apply to write");
  } else if (problems.length || invalid.length) {
    console.log("Not written: fix the problems above first");
    process.exitCode = 1;
  } else {
    let profiles = 0;
    let sections = 0;
    for (const { plan, profile } of docs) {
      await profile.save();
      await Section.insertMany(plan.sections);
      profiles += 1;
      sections += plan.sections.length;
    }
    console.log(`Wrote ${profiles} block profiles and ${sections} sections`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

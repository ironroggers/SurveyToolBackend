// Uploads each block's DTP and BOQ KML to S3 and adds it to the block profile's KML files,
// as the portal's KML upload does.
//
//   node scripts/uploadBlockKml.js <KML folder>           dry run: prints what would be uploaded
//   node scripts/uploadBlockKml.js <KML folder> --apply   uploads
//
// The folder holds DTP/<BLOCK>/DTP.kml and BOQ/<BLOCK>/BOQ.kml. Block folders are matched to the
// block profiles by name (a few spellings differ from the LGD master, see ALIASES). A block that
// already has a KML file of that name is skipped, so the script is safe to run again.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import BlockProfile from "../src/models/blockProfile.model.js";
import { getS3Bucket, uploadBuffer } from "../src/utils/s3.js";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const ROOT = process.argv.slice(2).find((a) => !a.startsWith("--"));
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";
const KINDS = ["DTP", "BOQ"];
const CONTENT_TYPE = "application/vnd.google-earth.kml+xml";

const key = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// Folder spelling -> LGD master spelling
const ALIASES = { VARAKALA: "VARKALA", VYPIN: "VYPEEN", ATHIYANOOR: "ATHIYANNOOR", KUTTIPURAM: "KUTTIPPURAM", IDDUKI: "IDUKKI" };

const run = async () => {
  if (!ROOT) throw new Error("Give the KML folder: node scripts/uploadBlockKml.js <folder> [--apply]");
  const bucket = getS3Bucket();
  if (APPLY && !bucket) throw new Error("S3_BUCKET is not set");

  await mongoose.connect(MONGODB_URI);
  const profiles = await BlockProfile.find().select("block blockCode kmlFiles");
  const byName = new Map(profiles.map((p) => [key(p.block), p]));

  const uploads = [];
  const problems = [];
  let already = 0;
  for (const kind of KINDS) {
    const dir = path.join(ROOT, kind);
    for (const folder of (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
      const profile = byName.get(ALIASES[key(folder)] || key(folder));
      const file = path.join(dir, folder, `${kind}.kml`);
      if (!profile) {
        problems.push(`${kind}/${folder}: no block profile with that name`);
        continue;
      }
      if (!(await stat(file).catch(() => null))) {
        problems.push(`${kind}/${folder}: no ${kind}.kml`);
        continue;
      }
      if (profile.kmlFiles.some((f) => f.name === `${kind}.kml`)) {
        already += 1;
        continue;
      }
      uploads.push({ kind, folder, profile, file });
    }
  }

  const count = (kind) => uploads.filter((u) => u.kind === kind).length;
  console.log(`To upload: ${count("DTP")} DTP and ${count("BOQ")} BOQ KML files to ${new Set(uploads.map((u) => u.profile.blockCode)).size} blocks`);
  if (already) console.log(`Already uploaded (skipped): ${already}`);
  const renamed = uploads.filter((u) => key(u.folder) !== key(u.profile.block));
  renamed.forEach((u) => console.log(`  ${u.kind}/${u.folder} -> ${u.profile.block}`));
  if (problems.length) {
    console.log(`Problems (${problems.length}):`);
    problems.forEach((p) => console.log(`  ${p}`));
  }

  if (!APPLY) {
    console.log("Dry run; add --apply to upload");
  } else {
    let done = 0;
    for (const u of uploads) {
      const name = `${u.kind}.kml`;
      const s3Key = `${process.env.S3_PREFIX || "uploads"}/${uuidv4()}-${name}`;
      const sizeBytes = await uploadBuffer(s3Key, await readFile(u.file), CONTENT_TYPE);
      const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      u.profile.kmlFiles.push({ name, url, s3Key, sizeBytes, uploadedAt: new Date() });
      await u.profile.save({ validateModifiedOnly: true });
      done += 1;
    }
    console.log(`Uploaded ${done} KML files`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

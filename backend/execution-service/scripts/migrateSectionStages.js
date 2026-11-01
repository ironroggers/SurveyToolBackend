// One-off migration for the section stages. Don't run it without checking the dry run first.
//
//   node scripts/migrateSectionStages.js           dry run: prints what would change
//   node scripts/migrateSectionStages.js --apply   writes the changes
//
//   - sections at ZONAL, ADMIN or FROZEN stay where they are and get all 6 stages marked
//     complete, so a send-back reopens only the picked stages
//   - sections in FIELD start with no stages complete: nothing to write, the count is reported
// Safe to run again.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { STAGE_ORDER } from "../src/config/executionTypes.js";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const sections = mongoose.connection.db.collection("Section");
  const block = { blockProfile: { $exists: true, $ne: null } };
  const forwarded = { ...block, "review.stage": { $in: ["ZONAL", "ADMIN", "FROZEN"] }, "stageCompletion.EXCAVATION.at": { $exists: false } };
  const field = { ...block, $or: [{ "review.stage": "FIELD" }, { "review.stage": { $exists: false } }] };
  const [forwardedCount, fieldCount] = await Promise.all([sections.countDocuments(forwarded), sections.countDocuments(field)]);
  console.log(`${fieldCount} block section(s) in FIELD: each needs all ${STAGE_ORDER.length} stages before it can forward`);
  console.log(`${forwardedCount} block section(s) at ZONAL or above get their stages marked complete`);
  if (!APPLY) {
    console.log("Dry run; add --apply to write");
  } else {
    const done = { at: new Date(), by: { name: "Migration" } };
    const result = await sections.updateMany(forwarded, { $set: { stageCompletion: Object.fromEntries(STAGE_ORDER.map((stage) => [stage, done])) } });
    console.log(`Updated ${result.modifiedCount} section(s)`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

// One-off cleanup after the demo block feature was removed: deletes the demo block
// (BlockProfile.isDemo, "HARIPPAD (DEMO)") and everything under it. Without the
// feature nothing hides it any more, so run this wherever a demo block was built.
//
//   node scripts/removeDemoBlock.js           dry run: prints what would be deleted
//   node scripts/removeDemoBlock.js --apply   deletes it
//
// Safe to run again.
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const col = (name) => db.collection(name);

  const blocks = await col("BlockProfile").find({ isDemo: true }).project({ block: 1 }).toArray();
  const blockIds = blocks.map((b) => b._id);
  const sectionIds = await col("Section").distinct("_id", { blockProfile: { $in: blockIds } });
  const subIds = await col("SubSection").distinct("_id", { section: { $in: sectionIds } });

  const targets = [
    ["Trenching", { subSection: { $in: subIds } }],
    ["Restoration", { section: { $in: sectionIds } }],
    ["StageRecord", { blockProfile: { $in: blockIds } }],
    ["InfraCapture", { blockProfile: { $in: blockIds } }],
    ["InfraEquipment", { blockProfile: { $in: blockIds } }],
    ["SubSection", { _id: { $in: subIds } }],
    ["Section", { _id: { $in: sectionIds } }],
    ["BlockProfile", { _id: { $in: blockIds } }],
  ];

  console.log(`Demo block(s): ${blocks.map((b) => b.block).join(", ") || "none"}`);
  for (const [name, filter] of targets) console.log(`${name}: ${await col(name).countDocuments(filter)}`);
  if (!APPLY) {
    console.log("Dry run; add --apply to delete");
  } else if (blockIds.length) {
    for (const [name, filter] of targets) await col(name).deleteMany(filter);
    console.log("Deleted");
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

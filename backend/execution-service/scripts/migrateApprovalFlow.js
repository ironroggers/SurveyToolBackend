// One-off migration to the block profile approval flow (Cluster Head + GIS Head review,
// then Zonal Manager and Admin per section).
//
//   node scripts/migrateApprovalFlow.js           dry run: prints what would change
//   node scripts/migrateApprovalFlow.js --apply   writes the changes
//
//   - every ended execution subsection (waiting approval or approved) goes back to
//     waiting approval, for Cluster Head and GIS Head to review; rejected ones stay rejected
//   - block sections start at the FIELD stage; existing reviews are cleared
//   - block profiles get an empty team (assign it on the web: Admin the Zonal Managers,
//     the Zonal Manager the others)
// Safe to run again. The demo block is left out (Reset demo block rebuilds it).
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const profiles = db.collection("BlockProfile");
  const sections = db.collection("Section");
  const subs = db.collection("SubSection");

  const demoIds = await profiles.distinct("_id", { isDemo: true });
  const blockSectionIds = await sections.distinct("_id", { blockProfile: { $exists: true, $ne: null, $nin: demoIds } });

  const subFilter = {
    section: { $in: blockSectionIds },
    typeOfWork: { $exists: true },
    $or: [{ executionStatus: "APPROVED" }, { executionStatus: "PENDING_APPROVAL", review: { $exists: true } }, { executionStatus: "PENDING_APPROVAL", approval: { $exists: true } }],
  };
  const sectionFilter = { _id: { $in: blockSectionIds }, "review.stage": { $ne: "FIELD" } };
  const teamFilter = { isDemo: { $ne: true }, team: { $exists: false } };

  const [subCount, sectionCount, teamCount] = await Promise.all([
    subs.countDocuments(subFilter),
    sections.countDocuments(sectionFilter),
    profiles.countDocuments(teamFilter),
  ]);
  console.log(`${subCount} subsection(s) back to waiting approval (Cluster Head + GIS Head)`);
  console.log(`${sectionCount} block section(s) to the FIELD stage`);
  console.log(`${teamCount} block profile(s) get an empty team`);
  if (!APPLY) {
    console.log("Dry run; add --apply to write");
  } else {
    const at = new Date();
    const r1 = await subs.updateMany(subFilter, {
      $set: { executionStatus: "PENDING_APPROVAL" },
      $unset: { approval: "", review: "" },
      $push: { history: { at, type: "migrated", text: "Back to waiting approval for the Cluster Head and GIS Head review" } },
      $inc: { __v: 1 },
    });
    const r2 = await sections.updateMany(sectionFilter, { $set: { review: { stage: "FIELD", history: [] } } });
    const r3 = await profiles.updateMany(teamFilter, { $set: { team: [] } });
    console.log(`Updated ${r1.modifiedCount} subsection(s), ${r2.modifiedCount} section(s), ${r3.modifiedCount} block profile(s)`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

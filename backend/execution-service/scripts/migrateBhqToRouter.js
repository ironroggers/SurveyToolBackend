// One-off migration: the block router replaces the Block HQ (BHQ).
//
//   node scripts/migrateBhqToRouter.js           dry run: prints what would change
//   node scripts/migrateBhqToRouter.js --apply   writes the changes
//
// Per block profile:
//   - blockRouter takes the BHQ's coordinates when it has none, the BHQ's name as its
//     address when it has none, and the block's site type
//   - bhq, siteType, startDate and endDate are removed
//   - section ends of type BHQ become { type: ROUTER, code: blockCode, name: "Block router" }
//   - GP equipment sheets whose previous / next node was the BHQ code point at blockCode
// Safe to run again: blocks already migrated are left as they are.
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";
const ROUTER_NAME = "Block router";

const hasPoint = (p) => p && p.latitude != null && p.longitude != null && p.latitude !== "" && p.longitude !== "";
const latLong = (p) => (hasPoint(p) ? `${p.latitude}, ${p.longitude}` : "");

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const profiles = db.collection("BlockProfile");
  const sections = db.collection("Section");
  const equipment = db.collection("InfraEquipment");

  const legacy = await profiles
    .find({ $or: [{ bhq: { $exists: true } }, { siteType: { $exists: true } }, { startDate: { $exists: true } }, { endDate: { $exists: true } }] })
    .toArray();
  console.log(`${legacy.length} block profile(s) to migrate${APPLY ? "" : " (dry run; add --apply to write)"}`);

  for (const p of legacy) {
    const bhq = p.bhq || {};
    const router = { ...(p.blockRouter || {}) };
    if (!hasPoint(router) && hasPoint(bhq)) {
      router.latitude = bhq.latitude;
      router.longitude = bhq.longitude;
    }
    if (!router.address && bhq.name) router.address = bhq.name;
    if (p.siteType && !router.siteType) router.siteType = p.siteType;

    const routerEnd = { type: "ROUTER", code: p.blockCode, name: ROUTER_NAME, latitude: router.latitude, longitude: router.longitude };
    const blockSections = await sections.find({ blockProfile: p._id, $or: [{ "fromNode.type": "BHQ" }, { "toNode.type": "BHQ" }] }).toArray();
    const sectionOps = blockSections.map((s) => {
      const set = {};
      if (s.fromNode?.type === "BHQ") Object.assign(set, { fromNode: { ...s.fromNode, ...routerEnd }, fromLatLong: latLong(router) });
      if (s.toNode?.type === "BHQ") Object.assign(set, { toNode: { ...s.toNode, ...routerEnd }, toLatLong: latLong(router) });
      return { updateOne: { filter: { _id: s._id }, update: { $set: set } } };
    });

    const ringOps = bhq.code
      ? ["prevNode", "nextNode"].map((key) => ({
          updateMany: { filter: { blockProfile: p._id, [key]: bhq.code }, update: { $set: { [key]: p.blockCode } } },
        }))
      : [];
    const ringCount = bhq.code ? await equipment.countDocuments({ blockProfile: p._id, $or: [{ prevNode: bhq.code }, { nextNode: bhq.code }] }) : 0;

    console.log(
      `- ${p.block} (${p.blockCode}): router ${hasPoint(router) ? latLong(router) : "without coordinates"}` +
        `${router.siteType ? `, ${router.siteType}` : ""}; ${sectionOps.length} section(s), ${ringCount} equipment sheet(s) re-pointed`
    );
    if (!APPLY) continue;

    await profiles.updateOne({ _id: p._id }, { $set: { blockRouter: router }, $unset: { bhq: "", siteType: "", startDate: "", endDate: "" } });
    if (sectionOps.length) await sections.bulkWrite(sectionOps);
    if (ringOps.length) await equipment.bulkWrite(ringOps);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

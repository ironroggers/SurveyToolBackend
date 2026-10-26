// One-off migration: the Execution Engineer role is now Field Executive.
//
//   node src/scripts/renameExecutionEngineer.js           dry run: prints what would change
//   node src/scripts/renameExecutionEngineer.js --apply   writes the changes
//
// Users keep their old role in their login token until they sign in again; the
// execution service reads EXECUTION ENGINEER as FIELD EXECUTIVE meanwhile.
// Safe to run again.
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const APPLY = process.argv.includes("--apply");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.db.collection("User");
  const filter = { role: "EXECUTION ENGINEER" };
  const count = await users.countDocuments(filter);
  console.log(`${count} user(s) with role EXECUTION ENGINEER${APPLY ? "" : " (dry run; add --apply to write)"}`);
  if (APPLY && count) {
    const result = await users.updateMany(filter, { $set: { role: "FIELD EXECUTIVE" } });
    console.log(`Renamed ${result.modifiedCount} to FIELD EXECUTIVE`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

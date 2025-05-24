import mongoose from "mongoose";

export default async function initializeDB() {
  try {
    console.log("Connecting to MongoDB");
    const uri =
      process.env.MONGODB_URI ||
      "mongodb+srv://akshaysince98:VCtbRuAMsBwF8fKV@taskmanage.w8aip.mongodb.net/";
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

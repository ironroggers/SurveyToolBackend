import mongoose from "mongoose";
import locationModel from "../models/location.model.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createLocations = async () => {
  try {
    // Load environment variables
    dotenv.config();

    // Connect to MongoDB
    const db = await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB successfully!");

    // Read the locations JSON file
    const locationsPath = path.join(__dirname, "locations.json");
    const locationsData = JSON.parse(fs.readFileSync(locationsPath, "utf8"));
    console.log(`Read ${locationsData.length} locations from ${locationsPath}`);

    // Clear existing locations
    // await locationModel.deleteMany({});
    console.log("Cleared existing locations");

    // Insert all locations
    const result = await locationModel.insertMany(locationsData);
    console.log(`Successfully inserted ${result.length} locations`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

createLocations();

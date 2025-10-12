import mongoose from "mongoose";

// Minimal schemas with strict: false to allow flexible documents
function createPassthroughModel(modelName, collectionName) {
  const schema = new mongoose.Schema({}, { strict: false, timestamps: true });
  return (
    mongoose.models[modelName] ||
    mongoose.model(modelName, schema, collectionName)
  );
}

// Attendance service
export const Attendance = createPassthroughModel("Attendance", "Attendance");

// Auth service
export const User = createPassthroughModel("User", "User");

// Execution service
export const Section = createPassthroughModel("Section", "Section");
export const SubSection = createPassthroughModel("SubSection", "SubSection");
export const Trenching = createPassthroughModel("Trenching", "Trenching");

// HOTO service
export const Hoto = createPassthroughModel("Hoto", "Hoto");
export const HotoLocation = createPassthroughModel("HotoLocation", "Location");

// Location service
export const Location = createPassthroughModel("Location", "Location");

// Notification service
export const Notification = createPassthroughModel(
  "Notification",
  "Notification"
);

// Route service
export const Route = createPassthroughModel("Route", "Route");

// Survey service
export const Survey = createPassthroughModel("Survey", "Survey");

// Note: Some services reuse collection names like "User" and "Location".
// We expose one model per collection name; for HOTO Location we alias as HotoLocation.

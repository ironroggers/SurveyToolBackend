import mongoose from "mongoose";

// This is a simplified version of the Location schema used just for population
// The full model remains in the location-service
const locationSchema = new mongoose.Schema(
  {
    district: {
      type: String,
      trim: true
    },
    block: {
      type: String,
      trim: true
    },
    route: {
      type: Array,
      default: []
    },
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    status: {
      type: Number
    },
    surveyor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Location", locationSchema, "Location"); 
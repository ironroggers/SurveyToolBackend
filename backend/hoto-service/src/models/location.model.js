import mongoose from "mongoose";

// This is a simplified version of the Location schema used just for population
// The full model remains in the location-service
const locationSchema = new mongoose.Schema(
  {
    district: {
      type: String,
      trim: true,
      required: [true, "District is required"]
    },
    block: {
      type: String,
      trim: true,
      required: [true, "Block is required"]
    },
    status: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6], // 1: Released, 2: Assigned, 3: Active, 4: Completed, 5: Accepted, 6: Reverted
      default: 1
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
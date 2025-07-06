import mongoose from "mongoose";

const routeItemSchema = new mongoose.Schema(
  {
    place: {
      type: String,
      trim: true,
      required: [true, "Place is required"],
    },
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      validate: {
        validator: function (value) {
          return value >= -90 && value <= 90;
        },
        message: "Invalid latitude. Must be between -90 and 90",
      },
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      validate: {
        validator: function (value) {
          return value >= -180 && value <= 180;
        },
        message: "Invalid longitude. Must be between -180 and 180",
      },
    },
    type: {
      type: String,
      trim: true,
      required: [true, "Type is required"],
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      trim: true,
    },
    state_code: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
      required: [true, "District is required"],
    },
    district_code: {
      type: String,
      trim: true,
    },
    block: {
      type: String,
      trim: true,
      required: [true, "Block is required"],
    },
    block_code: {
      type: String,
      trim: true,
    },
    block_address: {
      type: String,
      trim: true,
    },
    route: {
      type: [routeItemSchema],
      default: [],
    },
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6], // 1: Released, 2: Assigned, 3: Active, 4: Completed, 5: Accepted, 6: Reverted
      required: [true, "Status is required"],
      default: 1, // Default to Released
    },
    surveyor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    due_date: {
      type: Date,
    },
    updated_on: {
      type: Date,
    },
    time_taken: {
      type: Number, // in minutes
    },
    comments: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields
locationSchema.index({ district: 1, block: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ assigned_to: 1 });
locationSchema.index({ surveyor: 1 });
locationSchema.index({ supervisor: 1 });

export default mongoose.model("Location", locationSchema, "Location");

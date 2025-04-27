import mongoose from "mongoose";

const routeItemSchema = new mongoose.Schema({
  gram_panchayat: {
    type: String,
    trim: true
  },
  from_place: {
    type: String,
    trim: true
  },
  from_lat_long: {
    type: [Number],
    validate: {
      validator: function(coords) {
        return coords.length === 2 &&
               coords[0] >= -90 && coords[0] <= 90 &&
               coords[1] >= -180 && coords[1] <= 180;
      },
      message: "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180"
    }
  },
  to_place: {
    type: String,
    trim: true,
    required: [true, "To place is required"]
  },
  to_lat_long: {
    type: [Number],
    validate: {
      validator: function(coords) {
        return coords.length === 2 &&
               coords[0] >= -90 && coords[0] <= 90 &&
               coords[1] >= -180 && coords[1] <= 180;
      },
      message: "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180"
    }
  },
  distance: {
    type: Number
  }
}, { _id: false });

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
    route: {
      type: [routeItemSchema],
      default: []
    },
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    status: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6], // 1: Released, 2: Assigned, 3: Active, 4: Completed, 5: Accepted, 6: Reverted
      required: [true, "Status is required"],
      default: 1 // Default to Released
    },
    surveyor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    start_date: {
      type: Date
    },
    end_date: {
      type: Date
    },
    due_date: {
      type: Date
    },
    updated_on: {
      type: Date
    },
    time_taken: {
      type: Number // in minutes
    },
    comments: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Add indexes for frequently queried fields
locationSchema.index({ district: 1, block: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ assigned_to: 1 });
locationSchema.index({ surveyor: 1 });
locationSchema.index({ supervisor: 1 });

export default mongoose.model("Location", locationSchema, "Location");

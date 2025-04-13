import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true
    },
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Survey"
    },
    geofence: {
      type: {
        type: String,
        enum: ["Polygon"],
        default: "Polygon"
      },
      coordinates: {
        type: [[Number]],
        required: true,
        validate: {
          validator: function(coords) {
            return coords.length > 0 && coords[0].length >= 3;
          },
          message: "Polygon must have at least 3 points"
        }
      }
    },
    centerPoint: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point"
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function(coords) {
            return coords.length === 2;
          },
          message: "Coordinates must be [longitude, latitude]"
        }
      }
    },
    radius: {
      type: Number,
      min: [0, "Radius cannot be negative"]
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "COMPLETED"],
      default: "ACTIVE"
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for geospatial queries
locationSchema.index({ geofence: "2dsphere" });
locationSchema.index({ centerPoint: "2dsphere" });
locationSchema.index({ surveyId: 1 });
locationSchema.index({ assignedTo: 1 });

export default mongoose.model("Location", locationSchema, "Location");

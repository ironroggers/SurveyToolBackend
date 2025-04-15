import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    comments: {
      type: String,
      trim: true,
      required: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    geofence: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true
      },
      coordinates: {
        type: [[[Number]]],
        required: true,
        validate: {
          validator: function(coords) {
            // Check if it's a valid polygon (closed shape)
            if (coords.length > 0 && coords[0].length >= 4) {
              const firstPoint = coords[0][0];
              const lastPoint = coords[0][coords[0].length - 1];
              return firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1];
            }
            return false;
          },
          message: "Polygon must be closed and have at least 4 points"
        }
      }
    },
    centerPoint: {
      type: {
        type: String,
        enum: ["Point"],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function(coords) {
            return coords.length === 2 &&
                   coords[0] >= -180 && coords[0] <= 180 &&
                   coords[1] >= -90 && coords[1] <= 90;
          },
          message: "Invalid coordinates. Longitude must be between -180 and 180, Latitude between -90 and 90"
        }
      }
    },
    radius: {
      type: Number,
      min: [0, "Radius cannot be negative"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "COMPLETED", "APPROVED", "REJECTED"],
      default: "INACTIVE",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for geospatial queries
locationSchema.index({ geofence: "2dsphere" });
locationSchema.index({ centerPoint: "2dsphere" });
locationSchema.index({ assignedTo: 1 });

export default mongoose.model("Location", locationSchema, "Location");

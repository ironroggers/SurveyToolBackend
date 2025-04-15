import mongoose from "mongoose";

const sublocationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: [true, "Title is required"],
    },
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: false,
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
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "COMPLETED"],
      default: "ACTIVE",
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    createdBy: {
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
sublocationSchema.index({ centerPoint: "2dsphere" });
sublocationSchema.index({ surveyId: 1 });
sublocationSchema.index({ location: 1 });
sublocationSchema.index({ createdBy: 1 });

export default mongoose.model("Sublocation", sublocationSchema, "Sublocation"); 
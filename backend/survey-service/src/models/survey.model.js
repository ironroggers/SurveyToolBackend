import mongoose from "mongoose";

const surveySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Survey title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters long"],
    },
    description: {
      type: String,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: [true, "Coordinates are required"],
      },
    },
    terrainData: {
      terrainType: {
        type: String,
        required: [true, "Terrain type is required"],
        enum: ["URBAN", "RURAL", "FOREST", "MOUNTAIN", "WETLAND", "COASTAL"],
      },
      elevation: {
        type: Number,
        required: [true, "Elevation is required"],
        min: [0, "Elevation cannot be negative"],
      },
      existingInfrastructure: [
        {
          type: String,
          enum: ["POLES", "DUCTS", "MANHOLES", "FIBER_CABLES", "NONE"],
        },
      ],
    },
    mediaFiles: [
      {
        url: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
          required: true,
          enum: ["IMAGE", "VIDEO", "DOCUMENT"],
        },
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Survey must be assigned to a surveyor"],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Survey must have an assigner"],
    },
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: [true, "Comment text is required"],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    completedAt: Date,
    rejectionReason: {
      type: String,
    },
    status: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

surveySchema.index({ location: "2dsphere" });
surveySchema.index({ status: 1 });
surveySchema.index({ assignedTo: 1 });
surveySchema.index({ assignedBy: 1 });
surveySchema.index({ "terrainData.terrainType": 1 });

surveySchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "APPROVED") {
    this.completedAt = new Date();
  }
  next();
});

surveySchema.methods.isEditable = function () {
  return ["PENDING", "IN_PROGRESS", "REJECTED"].includes(this.status);
};

surveySchema.statics.findNearby = function (coordinates, maxDistance) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates,
        },
        $maxDistance: maxDistance,
      },
    },
  });
};

export default mongoose.model("Survey", surveySchema, "Survey");

import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    points: [
      {
        surveyId: {
          type: String,
          ref: "Survey",
        },
        location: {
          type: {
            type: String,
            enum: ["Point"],
          },
          coordinates: [Number],
        },
        order: Number,
      },
    ],
    distance: {
      type: Number,
    },
    optimizationParameters: {
      costFactors: {
        distance: Number,
        terrain: Number,
        infrastructure: Number,
      },
      constraints: {
        maxDistance: Number,
        avoidZones: [
          {
            type: {
              type: String,
              enum: ["Polygon"],
            },
            coordinates: [[Number]],
          },
        ],
      },
    },
    status: {
      type: String,
      enum: ["DRAFT", "OPTIMIZING", "COMPLETED", "FAILED"],
      default: "DRAFT",
    },
    exportFormats: [
      {
        type: String,
        format: {
          type: String,
          enum: ["KML", "GPX", "CSV"],
        },
        url: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

routeSchema.index({ "points.location": "2dsphere" });

export default mongoose.model("Route", routeSchema, "Route");

import mongoose from "mongoose";

const surveySchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: [true, "Location is required"],
    },
    latlong: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 &&
                 coords[0] >= -90 && coords[0] <= 90 &&
                 coords[1] >= -180 && coords[1] <= 180;
        },
        message: "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180"
      }
    },
    created_on: {
      type: Date,
      default: Date.now,
      required: true
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
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
        uploaded_at: {
          type: Date,
          default: Date.now,
        },
        latitude: {
          type: Number,
          required: true,
          min: -90,
          max: 90
        },
        longitude: {
          type: Number,
          required: true,
          min: -180,
          max: 180
        },
        deviceName: {
          type: String,
          required: true
        },
        accuracy: {
          type: Number,
          required: true
        },
        place: {
          type: String,
          trim: true,
        },
      },
    ],
    terrainData: {
      type: {
        type: String,
        enum: ["URBAN", "RURAL", "FOREST", "MOUNTAIN", "WETLAND", "COASTAL"],
      },
    },
    rowAuthority: {
      type: String,
      enum: ["NHAI", "NH", "State Highway", "Forest", "Municipal Coorporation", "Municipality", "Gram Panchayat", "Railway", "Private Road", "Others"],
    },
    others: {
      type: mongoose.Schema.Types.Mixed,
    },
    updated_on: {
      type: Date,
      default: Date.now,
    },
    updated_by: {
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

surveySchema.index({ status: 1 });
surveySchema.index({ created_by: 1 });
surveySchema.index({ "terrainData.type": 1 });
surveySchema.index({ location: 1 });
surveySchema.index({ latlong: "2d" });
surveySchema.index({ rowAuthority: 1 });

surveySchema.statics.findNearby = async function (coordinates, maxDistance) {
  return this.find({
    latlong: {
      $near: coordinates,
      $maxDistance: maxDistance
    }
  });
};

export default mongoose.model("Survey", surveySchema, "Survey");

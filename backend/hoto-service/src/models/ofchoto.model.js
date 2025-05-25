import mongoose from "mongoose";

const ofcHotoSchema = new mongoose.Schema(
  {
    State: {
      type: String,
      required: true,
      trim: true,
    },
    District_Code: {
      type: String,
      required: true,
      trim: true,
    },
    Block_Code: {
      type: String,
      required: true,
      trim: true,
    },
    GP_Code: {
      type: String,
      required: true,
      trim: true,
    },
    GP_Name: {
      type: String,
      required: true,
      trim: true,
    },
    FPOI_Latitude: {
      type: String,
      trim: true,
    },
    FPOI_Longitude: {
      type: String,
      trim: true,
    },
    FPOI_Closure_Available: {
      type: String,
      enum: ["Yes", "No"],
      trim: true,
    },
    FPOI_Joint_Closure_Photos: {
      type: [String],
      default: [],
    },
    OTDR_Length_FPOI_to_GP: {
      type: Number,  // in meters
    },
    OTDR_Trace_Files: {
      type: [String], // for PDF and image uploads
      default: [],
    },
    Overhead_Sections_Count: {
      type: Number,
      default: 0,
    },
    Total_Overhead_Stretch_Length: {
      type: Number, // in meters
      default: 0,
    },
    Overhead_Sections: {
      type: [{
        From_Latitude: String,
        From_Longitude: String,
        From_Photos: [String],
        To_Latitude: String,
        To_Longitude: String,
        To_Photos: [String],
        Calculated_Length: Number,
      }],
      default: [],
    },
    L14_Diagram_Files: {
      type: [String], // for PDF and image uploads
      default: [],
    },
    ROW_Document_Files: {
      type: [String], // for PDF and image uploads
      default: [],
    },
    Joints_Count: {
      type: Number,
      default: 0,
    },
    Chambers_Count: {
      type: Number,
      default: 0,
    },
    Chambers: {
      type: [{
        Latitude: String,
        Longitude: String,
        Photos: [String],
      }],
      default: [],
    },
    status: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    blockHoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BLOCK_HOTO",
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Add pre-save middleware for validation
ofcHotoSchema.pre("save", function (next) {
  const requiredFields = [
    "State",
    "District_Code",
    "Block_Code",
    "GP_Code",
    "GP_Name",
    "createdBy",
    "location",
    "blockHoto",
  ];

  const errors = [];

  requiredFields.forEach((field) => {
    if (!this[field]) {
      errors.push(`${field} is required`);
    }
  });

  if (errors.length > 0) {
    next(new Error(errors.join(", ")));
  } else {
    next();
  }
});

const OFCHoto = mongoose.model("OFC_HOTO", ofcHotoSchema);
export default OFCHoto; 
import mongoose from "mongoose";

const summarySchema = new mongoose.Schema(
  {
    sheetName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    rowData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    rowNumber: {
      type: Number,
      index: true,
    },
    others: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

summarySchema.index({ sheetName: 1, rowNumber: 1 });

summarySchema.statics.getSheetNames = function () {
  return this.distinct("sheetName");
};

summarySchema.statics.getSheetData = function (sheetName) {
  return this.find({ sheetName }).sort({ rowNumber: 1 });
};

const Summary = mongoose.model("Summary", summarySchema, "Summary");

export default Summary;

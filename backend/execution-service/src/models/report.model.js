import mongoose from "mongoose";
import { actorSchema } from "./execution.schemas.js";

export const REPORT_LEVELS = ["BLOCK", "SECTION", "SUBSECTION"];

// What went into one sheet of the workbook: the catalog keys, so the same choice can be made again
const reportSheetSchema = new mongoose.Schema(
        {
                key: { type: String, required: true },
                label: String,
                columns: [String],
                rows: Number
        },
        { _id: false }
);

// An Excel report an Admin generated (services/report.service.js). The workbook is in S3;
// the names are copied at generation time so the list still reads after a rename or delete.
const reportSchema = new mongoose.Schema(
        {
                level: { type: String, enum: REPORT_LEVELS, required: true },
                blockProfile: { type: mongoose.Schema.Types.ObjectId, ref: "BlockProfile", required: true, index: true },
                section: { type: mongoose.Schema.Types.ObjectId, ref: "Section" },
                subSection: { type: mongoose.Schema.Types.ObjectId, ref: "SubSection" },
                // "Nagri › Section A › HDD-001"
                title: { type: String, trim: true },
                names: {
                        block: String,
                        district: String,
                        section: String,
                        subSection: String
                },
                sheets: { type: [reportSheetSchema], default: [] },
                fileName: { type: String, required: true },
                s3Key: { type: String, required: true },
                sizeBytes: Number,
                createdBy: actorSchema
        },
        { timestamps: true }
);

reportSchema.index({ createdAt: -1 });

export default mongoose.model("Report", reportSchema, "Report");

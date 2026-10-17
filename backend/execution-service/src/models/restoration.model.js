import mongoose from "mongoose";
import { mediaFileSchema } from "./mediaFile.schema.js";
import { actorSchema, approvalSchema, historySchema, withVersion } from "./execution.schemas.js";

// After photos and a video of one subsection once the area is restored.
// Saved to the server one by one, since restoring a section takes several visits.
const restorationItemSchema = new mongoose.Schema(
        {
                subSection: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "SubSection",
                        required: true
                },
                photos: [mediaFileSchema],
                video: mediaFileSchema,
                remarks: {
                        type: String,
                        trim: true
                },
                savedAt: Date,
                savedBy: actorSchema
        },
        { _id: false }
);

// One per section. LOCKED and READY are derived from the subsections, so only the
// submitted states are stored; status is unset while items are being saved.
const restorationSchema = new mongoose.Schema(
        {
                section: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Section",
                        required: true,
                        unique: true
                },
                status: {
                        type: String,
                        enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED"]
                },
                items: {
                        type: [restorationItemSchema],
                        default: []
                },
                submittedAt: Date,
                submittedBy: actorSchema,
                approval: approvalSchema,
                history: {
                        type: [historySchema],
                        default: []
                },
                updatedBy: actorSchema
        },
        {
                timestamps: true,
                optimisticConcurrency: true,
                toJSON: withVersion
        }
);

export default mongoose.model("Restoration", restorationSchema, "Restoration");

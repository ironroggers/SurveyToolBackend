import mongoose from "mongoose";
import { RECORD_STAGES } from "../config/executionTypes.js";
import { actorSchema, approvalSchema, historySchema, withVersion } from "./execution.schemas.js";
import { mediaFileSchema } from "./mediaFile.schema.js";

const objectId = (ref) => ({ type: mongoose.Schema.Types.ObjectId, ref });

// One piece of work in a section's Ducting, Coupling, Blowing, Chamber or Route Marker stage.
// `data` holds the fields from STAGE_FIELDS; `links` holds ids, so names can change safely.
// Pits sit in `data` as `<subsection id>:<start|end>`.
// A record is IN_PROGRESS (a draft) until submitted, then goes through Cluster Head + GIS
// Head like a subsection. Blowing's lengths in `data` are always the server's.
const stageRecordSchema = new mongoose.Schema(
        {
                section: { ...objectId("Section"), required: true },
                blockProfile: { ...objectId("BlockProfile"), required: true },
                stage: { type: String, enum: RECORD_STAGES, required: true },
                // MH, HH, LC, JC, RI, CPL, DCT, BLW: seq runs per block and per code
                code: { type: String, required: true },
                seq: { type: Number, required: true },
                // A chamber's joint closure has its own number under JC
                jointSeq: Number,
                name: { type: String, trim: true, required: true },
                status: {
                        type: String,
                        enum: ["IN_PROGRESS", "PENDING_APPROVAL", "APPROVED", "REJECTED"],
                        default: "IN_PROGRESS"
                },
                // The latest decision, shown as the status reason
                approval: approvalSchema,
                review: {
                        clusterHead: approvalSchema,
                        gisHead: approvalSchema
                },
                history: { type: [historySchema], default: [] },
                latitude: Number,
                longitude: Number,
                accuracy: Number,
                accuracyAboveLimit: Boolean,
                photos: [mediaFileSchema],
                remarks: { type: String, trim: true },
                data: { type: mongoose.Schema.Types.Mixed, default: {} },
                links: {
                        subSection: objectId("SubSection"),
                        beside: objectId("StageRecord")
                },
                submittedAt: Date,
                submittedBy: actorSchema,
                createdBy: actorSchema,
                updatedBy: actorSchema
        },
        {
                timestamps: true,
                // Every save bumps __v and fails if someone saved in between (sent to clients as `version`)
                optimisticConcurrency: true,
                minimize: false,
                toJSON: withVersion
        }
);

stageRecordSchema.index({ section: 1, stage: 1, status: 1 });
stageRecordSchema.index({ status: 1, section: 1 });
stageRecordSchema.index({ "photos.url": 1 });
// A safety net behind the atomic counter on the block
stageRecordSchema.index({ blockProfile: 1, code: 1, seq: 1 }, { unique: true });
// A subsection can have only one duct run
stageRecordSchema.index({ "links.subSection": 1 }, { unique: true, partialFilterExpression: { stage: "DUCTING", "links.subSection": { $exists: true } } });
// One coupling per pit
stageRecordSchema.index({ section: 1, "data.pit": 1 }, { unique: true, partialFilterExpression: { stage: "COUPLING", "data.pit": { $exists: true } } });

export default mongoose.model("StageRecord", stageRecordSchema, "StageRecord");

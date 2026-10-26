import mongoose from "mongoose";
import { NODE_TYPES } from "../utils/blockNodes.js";
import { approvalSchema, historySchema } from "./execution.schemas.js";

// Where a block section is in the approval flow:
//   FIELD:  subsections being executed and reviewed by Cluster Head + GIS Head
//   ZONAL:  every subsection approved by both; with the Zonal Manager
//   ADMIN:  approved by the Zonal Manager; with Admin
//   FROZEN: approved by Admin; read-only for everyone else
export const SECTION_STAGES = ["FIELD", "ZONAL", "ADMIN", "FROZEN"];

const sectionReviewSchema = new mongoose.Schema(
        {
                stage: {
                        type: String,
                        enum: SECTION_STAGES,
                        default: "FIELD"
                },
                // The latest decision at each level
                zonal: approvalSchema,
                admin: approvalSchema,
                history: {
                        type: [historySchema],
                        default: []
                }
        },
        { _id: false }
);

// One end of a block section: the block router (code: the block's LGD code) or one of its GPs (code: the GP's LGD code)
const sectionEndSchema = new mongoose.Schema(
        {
                type: {
                        type: String,
                        enum: NODE_TYPES,
                        required: true
                },
                code: {
                        type: String,
                        trim: true,
                        required: true
                },
                name: {
                        type: String,
                        trim: true
                }
        },
        { _id: false }
);

const sectionSchema = new mongoose.Schema({
        name: {
                type: String,
                trim: true
        },
        description: {
                type: String,
                trim: true
        },
        state: {
                type: String,
                trim: true
        },
        block: {
                type: String,
                trim: true
        },
        district: {
                type: String,
                trim: true
        },
        stateCode: {
                type: String,
                trim: true
        },
        blockCode: {
                type: String,
                trim: true
        },
        districtCode: {
                type: String,
                trim: true
        },
        // Older sections hang off a Location; new ones belong to a BlockProfile
        location: {
                type: mongoose.Schema.Types.ObjectId,
                required: [
                        function () {
                                return !this.blockProfile;
                        },
                        "Location or block profile is required"
                ]
        },
        blockProfile: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "BlockProfile",
                index: true
        },
        // Block sections only. fromLatLong / toLatLong are then filled from these nodes.
        fromNode: {
                type: sectionEndSchema
        },
        toNode: {
                type: sectionEndSchema
        },
        fromLatLong: {
                type: String,
                trim: true
        },
        toLatLong: {
                type: String,
                trim: true
        },
        // Total length: the sum of the three path lengths below when they're given
        sectionLength: {
                type: Number,
                default: 0
        },
        // Parts of the section's length in metres: the main path, the path shared with
        // another section, and the existing path added incrementally
        mainPathLength: {
                type: Number,
                min: [0, "Main path length can't be negative"]
        },
        sharingPathLength: {
                type: Number,
                min: [0, "Sharing path length can't be negative"]
        },
        existingIncrementalPathLength: {
                type: Number,
                min: [0, "Existing incremental path length can't be negative"]
        },

        status: {
                type: Number,
                default: 1
        },
        // NEW: OFC laid in this project; EXISTING: an older route reused (dashed on the diagrams)
        routeType: {
                type: String,
                enum: ["NEW", "EXISTING"],
                default: "NEW"
        },
        // Last sequence number given to an execution subsection (incremented atomically)
        subSectionSeq: {
                type: Number,
                default: 0
        },
        // Block sections only; missing on older sections, which read as FIELD
        review: sectionReviewSchema,
        others : {
                type: mongoose.Schema.Types.Mixed,
        }
})

sectionSchema.index({ blockProfile: 1, "review.stage": 1 });

export default mongoose.model("Section", sectionSchema, "Section");
import mongoose from "mongoose";
import { EXECUTION_TYPES, STATUS_ORDER } from "../config/executionTypes.js";
import {
    actorSchema,
    approvalSchema,
    executionPointSchema,
    historySchema,
    initialConditionSchema,
    withVersion,
} from "./execution.schemas.js";
import { calculatedLengthOf } from "../utils/geo.js";

const rowSchema = new mongoose.Schema({
    rowOwnership: {
        type: String,
        trim: true
    },
    rowAuthority: {
        type: String,
    },
    rowAuthorityName: {
        type: String,
    },
    rowAuthorityAddress: {
        type: String,
    },
    rowFeasibility: {
        type: String,
    },
    others : {
        type: Object,
    }
})
const subSectionSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    section: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Section",
        required: [true, "Form ID is required"]
    },
    fromLatLong: {
        type: String,
        trim: true
    },
    toLatLong: {
        type: String,
        trim: true
    },
    subSectionLength: {
        type: Number,
        default: 0
    },
    roadName: {
        type: String,
        trim: true
    },
    row: rowSchema,
    proposedOfcSide: {
        type: String,
        trim: true,
        enum: ['LHS', 'RHS', 'BOTH']
    },
    alignmentType: {
        type: String,
        trim: true,
        enum: ['Road Crossing', 'Along the road', 'others']
    },
    soilStatus: {
        type: String,
        trim: true,
        enum: ['Hard', 'Normal', 'Soft', 'Very Soft']
    },
    waterLoggedArea: {
        type: Boolean,
        default: false
    },
    roadSurfaceType: {
        type: String,
        trim: true,
        enum: ['Paved', 'Unpaved', 'others']
    },
    methodOfConstruction: {
        type: String,
        trim: true,
        enum: ['Open Trench', 'HDD', 'Clamping', 'In Building','others']
    },
    pitType: {
        type: String,
        trim: true,
        enum: ['Soil', 'Bitumen', 'Concrete','others']
    },
    estimatedDepth: {
        type: Number,
        default: 0
    },
    proposedOffsetFromCenterOfRoad: {
        type: Number,
        default: 0
    },
    protectionType: {
        type: String,
        trim: true,
        enum: ['DWC', 'GI', 'PCC','others']
    },
    remarks: {
        type: String,
        trim: true
    },
    trenching : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trenching",
    },
    status: {
        type: Number,
        default: 1
    },
    others : {
        type: mongoose.Schema.Types.Mixed,
    },

    // ---- OFC execution (subsections created by the execution wizard). Legacy
    // subsections have no typeOfWork and keep using the fields above only.
    typeOfWork: {
        type: String,
        enum: Object.keys(EXECUTION_TYPES)
    },
    // Per-section counter behind the generated name; never reused
    seq: {
        type: Number
    },
    // Separate from the numeric `status` above, which stays untouched
    executionStatus: {
        type: String,
        enum: STATUS_ORDER,
        default: function () {
            return this.typeOfWork ? "NOT_STARTED" : undefined;
        }
    },
    initialCondition: initialConditionSchema,
    start: executionPointSchema,
    end: executionPointSchema,
    // The latest decision (whoever made it), shown as the status reason
    approval: approvalSchema,
    // Cluster Head and GIS Head each review an ended subsection; it's APPROVED once both
    // have approved. A reject keeps the other's approval, so only the rejector reviews the fix.
    review: {
        clusterHead: approvalSchema,
        gisHead: approvalSchema
    },
    history: {
        type: [historySchema],
        default: undefined
    },
    createdBy: actorSchema,
    updatedBy: actorSchema
}, {
    timestamps: true,
    // Every save bumps __v and fails if someone saved in between (sent to clients as `version`)
    optimisticConcurrency: true,
    toJSON: withVersion
})

// Straight-line distance between the planned From and To points, whole metres. The engineer
// may enter a different length (subSectionLength); both are shown.
subSectionSchema.virtual("calculatedLength").get(function () {
    return calculatedLengthOf(this);
});

subSectionSchema.index({ section: 1, executionStatus: 1, typeOfWork: 1 });
// Generated names are unique per section; legacy names (no seq) are free text and may repeat
subSectionSchema.index(
    { section: 1, name: 1 },
    { unique: true, partialFilterExpression: { seq: { $exists: true } } }
);

export default mongoose.model("SubSection", subSectionSchema, "SubSection");
import mongoose from "mongoose";
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
    }
})
export default mongoose.model("SubSection", subSectionSchema, "SubSection");
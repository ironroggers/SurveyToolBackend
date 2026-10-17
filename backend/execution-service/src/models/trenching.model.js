import mongoose from "mongoose";
import { EXECUTION_TYPES } from "../config/executionTypes.js";
import { mediaFileSchema } from "./mediaFile.schema.js";
import { actorSchema } from "./execution.schemas.js";

const trenchingSchema = new mongoose.Schema({
    subSection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubSection",
        required: [true, "Form ID is required"]
    },
    trenchLength: {
        type: Number,
        default: 0
    },
    trenchDepth: {
        type: Number,
        default: 0
    },
    trenchType: {
        type: String,
        trim: true,
        enum: ["Open Trench", "Bridge Clamping", "HDD","In Building", "other"],
    },
    trenchLatLong: {
        type: String,
        trim: true
    },
    temperature: {
        type: Number,
        default: 0
    },
    angle : {
        type: Number,
        default: 0
    },
    protectionType: {
        type: String,
        trim: true,
        // Old values kept; the rest are the execution options
        enum: ["DWC", "GI with PCC", "other", "GI", "DWC PCC", "GI PCC", "RCC"],
    },
    mediaFiles : [mediaFileSchema],
    status: {
        type: Number,
        default: 1
    },
    others : {
        type: mongoose.Schema.Types.Mixed,
    },

    // ---- OFC execution entries (trenchLength / trenchDepth hold length and depth,
    // trenchLatLong the "lat,lng" text, mediaFiles[0] the optional photo)
    entryType: {
        type: String,
        enum: Object.keys(EXECUTION_TYPES)
    },
    offset: Number,
    side: {
        type: String,
        trim: true
    },
    landmark: {
        type: String,
        trim: true
    },
    clampOn: {
        type: String,
        trim: true
    },
    clampMethod: {
        type: String,
        trim: true
    },
    remarks: {
        type: String,
        trim: true
    },
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    accuracyAboveLimit: Boolean,
    capturedAt: Date,
    createdBy: actorSchema
}, {
    timestamps: true
})
export default mongoose.model("Trenching", trenchingSchema, "Trenching");
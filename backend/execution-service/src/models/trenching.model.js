import mongoose from "mongoose";
const mediaFileSchema = new mongoose.Schema({
    url: {
        type: String,
        required: [true, "Media file URL is required"]
    },
    fileType: {
        type: String,
        required: [true, "File type is required"],
        enum: ["IMAGE", "VIDEO", "DOCUMENT", "AUDIO"]
    },
    description: {
        type: String,
        trim: true
    },
    latitude: {
        type: String,
        required: [true, "Latitude is required for media file"]
    },
    longitude: {
        type: String,
        required: [true, "Longitude is required for media file"]
    },
    deviceName: {
        type: String,
        trim: true
    },
    accuracy: {
        type: Number
    },
    place: {
        type: String,
        trim: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
        required: [true, "Upload date is required"]
    }
}, { _id: true });

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
        enum: ["DWC", "GI with PCC","other"],
    },
    mediaFiles : [mediaFileSchema],
    status: {
        type: Number,
        default: 1
    },
    others : {
        type: mongoose.Schema.Types.Mixed,
    }
})
export default mongoose.model("Trenching", trenchingSchema, "Trenching");
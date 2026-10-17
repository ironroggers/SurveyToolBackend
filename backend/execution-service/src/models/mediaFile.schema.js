import mongoose from "mongoose";

// One photo, video or file stored in S3. Shared by trenching entries, OFC execution
// steps, restoration and infra capture. latitude / longitude stay strings because
// existing trenching media stores them that way.
export const mediaFileSchema = new mongoose.Schema({
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
    },
    s3Key: {
        type: String,
        trim: true
    },
    contentType: {
        type: String,
        trim: true
    },
    sizeBytes: {
        type: Number
    },
    capturedAt: {
        type: Date
    },
    durationSec: {
        type: Number
    },
    // Still frame shown for a video before it plays (web recordings)
    posterUrl: {
        type: String
    },
    // CAMERA: captured live in the app. UPLOAD: picked from the gallery or files.
    source: {
        type: String,
        enum: ["CAMERA", "UPLOAD"],
        default: "CAMERA"
    },
    // Where latitude / longitude came from; EXIF and MANUAL are badged for the approver
    locationSource: {
        type: String,
        enum: ["GPS", "EXIF", "MANUAL"],
        default: "GPS"
    },
    // Kept with "Use anyway" although the fix was worse than the accuracy limit
    accuracyAboveLimit: {
        type: Boolean,
        default: false
    }
}, { _id: true });

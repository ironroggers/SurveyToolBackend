import mongoose from "mongoose";

// One job per uploaded photo or video: burn the location stamp into the file and
// replace it in S3 (same key). Kept after it's done, so a file is never stamped twice.
const mediaStampSchema = new mongoose.Schema(
        {
                s3Key: {
                        type: String,
                        required: true,
                        unique: true
                },
                url: String,
                fileType: {
                        type: String,
                        enum: ["IMAGE", "VIDEO"]
                },
                // What the stamp shows, copied from the MediaFile when it was saved
                meta: {
                        latitude: Number,
                        longitude: Number,
                        accuracy: Number,
                        place: String,
                        capturedAt: Date,
                        deviceName: String,
                        source: String,
                        locationSource: String
                },
                status: {
                        type: String,
                        enum: ["PENDING", "PROCESSING", "DONE", "FAILED"],
                        default: "PENDING"
                },
                attempts: {
                        type: Number,
                        default: 0
                },
                error: String,
                startedAt: Date,
                doneAt: Date,
                sizeBytes: Number
        },
        { timestamps: true }
);

mediaStampSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("MediaStamp", mediaStampSchema, "MediaStamp");

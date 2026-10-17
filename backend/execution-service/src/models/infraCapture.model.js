import mongoose from "mongoose";
import { mediaFileSchema } from "./mediaFile.schema.js";
import { actorSchema, withVersion } from "./execution.schemas.js";

const infraPhotoSchema = new mongoose.Schema(
        {
                media: {
                        type: mediaFileSchema,
                        required: true
                },
                description: {
                        type: String,
                        trim: true
                }
        },
        { _id: false }
);

// Location and photos of the block HQ (level BLOCK) or one GP (level GP, matched to
// BlockProfile.gps by LGD code). Editable after saving.
const infraCaptureSchema = new mongoose.Schema(
        {
                blockProfile: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "BlockProfile",
                        required: true
                },
                level: {
                        type: String,
                        enum: ["BLOCK", "GP"],
                        required: true
                },
                gpLgdCode: {
                        type: String,
                        trim: true,
                        default: null
                },
                latitude: Number,
                longitude: Number,
                accuracy: Number,
                accuracyAboveLimit: Boolean,
                photos: {
                        type: [infraPhotoSchema],
                        default: []
                },
                capturedBy: actorSchema,
                updatedBy: actorSchema
        },
        {
                timestamps: true,
                optimisticConcurrency: true,
                toJSON: withVersion
        }
);

infraCaptureSchema.index({ blockProfile: 1, level: 1, gpLgdCode: 1 }, { unique: true });

export default mongoose.model("InfraCapture", infraCaptureSchema, "InfraCapture");

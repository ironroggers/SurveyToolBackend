import mongoose from "mongoose";
import { mediaFileSchema } from "./mediaFile.schema.js";

// Who did something: id and role from the login token, name from X-User-Name
export const actorSchema = new mongoose.Schema(
        {
                id: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User"
                },
                name: {
                        type: String,
                        trim: true
                },
                role: {
                        type: String,
                        trim: true
                }
        },
        { _id: false }
);

export const historySchema = new mongoose.Schema(
        {
                at: {
                        type: Date,
                        default: Date.now
                },
                type: {
                        type: String,
                        trim: true
                },
                text: {
                        type: String,
                        trim: true
                },
                by: actorSchema,
                client: {
                        type: String,
                        enum: ["mobile", "web"]
                },
                remark: {
                        type: String,
                        trim: true
                }
        },
        { _id: false }
);

export const approvalSchema = new mongoose.Schema(
        {
                status: {
                        type: String,
                        enum: ["APPROVED", "REJECTED"]
                },
                by: actorSchema,
                at: {
                        type: Date
                },
                remark: {
                        type: String,
                        trim: true
                },
                client: {
                        type: String,
                        enum: ["mobile", "web"]
                }
        },
        { _id: false }
);

// A fixed object near a pit, with the tape distance to the pit
export const referencePointSchema = new mongoose.Schema(
        {
                description: {
                        type: String,
                        trim: true
                },
                latitude: Number,
                longitude: Number,
                accuracy: Number,
                accuracyAboveLimit: Boolean,
                tapeDistanceM: Number,
                // Straight-line distance between the two GPS fixes, kept so the approver sees mismatches
                gpsDistanceM: Number,
                // Optional photos and video of the object
                photos: [mediaFileSchema],
                video: mediaFileSchema
        },
        { _id: false }
);

export const pitSchema = new mongoose.Schema(
        {
                latitude: Number,
                longitude: Number,
                accuracy: Number,
                accuracyAboveLimit: Boolean,
                // Set when the start pit was pre-filled from another subsection's end pit
                copiedFrom: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "SubSection"
                },
                refs: [referencePointSchema],
                // Optional photos and video of the pit
                photos: [mediaFileSchema],
                video: mediaFileSchema
        },
        { _id: false }
);

// Start or end of an execution. Ducting records a pit; other work just a location.
export const executionPointSchema = new mongoose.Schema(
        {
                // Server time
                at: Date,
                latitude: Number,
                longitude: Number,
                accuracy: Number,
                accuracyAboveLimit: Boolean,
                pit: pitSchema,
                photos: [mediaFileSchema],
                video: mediaFileSchema,
                remarks: {
                        type: String,
                        trim: true
                },
                by: actorSchema,
                client: {
                        type: String,
                        enum: ["mobile", "web"]
                }
        },
        { _id: false }
);

// Site condition before work starts. The first photo is the "before" picture in restoration.
export const initialConditionSchema = new mongoose.Schema(
        {
                capturedAt: Date,
                terrain: String,
                // Every crossing as one line of text (with Others' description), for display
                crossing: String,
                crossings: [String],
                crossingOther: {
                        type: String,
                        trim: true
                },
                crossingPhotos: [mediaFileSchema],
                ofcSide: String,
                roadFeatures: {
                        type: String,
                        trim: true
                },
                authorityName: {
                        type: String,
                        trim: true
                },
                remarks: {
                        type: String,
                        trim: true
                },
                photos: [mediaFileSchema],
                video: mediaFileSchema
        },
        { _id: false }
);

// Expose Mongoose's __v as `version` for the stale-update check
export const withVersion = {
        virtuals: true,
        transform: (doc, ret) => {
                ret.version = ret.__v;
                return ret;
        }
};

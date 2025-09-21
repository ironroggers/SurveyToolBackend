import mongoose from "mongoose";

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
        location: {
                type: mongoose.Schema.Types.ObjectId,
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
        sectionLength: {
                type: Number,
                default: 0
        },

        status: {
                type: Number,
                default: 1
        },
        others : {
                type: mongoose.Schema.Types.Mixed,
        }
})
export default mongoose.model("Section", sectionSchema, "Section");
import mongoose from "mongoose";

// The LGD master: one record per block with its state, district and GPs, loaded from the
// GP list Excel by scripts/importLgdMaster.js. Block profiles are filled in from it.
const lgdGpSchema = new mongoose.Schema(
        {
                name: { type: String, trim: true, required: true },
                lgdCode: { type: String, trim: true, required: true }
        },
        { _id: false }
);

const lgdBlockSchema = new mongoose.Schema(
        {
                state: { type: String, trim: true, required: true },
                stateCode: { type: String, trim: true, required: true },
                district: { type: String, trim: true, required: true },
                districtCode: { type: String, trim: true, required: true },
                block: { type: String, trim: true, required: true },
                blockCode: { type: String, trim: true, required: true, unique: true },
                gps: { type: [lgdGpSchema], default: [] }
        },
        { timestamps: true }
);

lgdBlockSchema.index({ district: 1, block: 1 });

export default mongoose.model("LgdBlock", lgdBlockSchema, "LgdBlock");

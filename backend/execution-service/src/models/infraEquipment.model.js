import mongoose from "mongoose";
import { mediaFileSchema } from "./mediaFile.schema.js";
import { actorSchema, withVersion } from "./execution.schemas.js";
import { EQUIPMENT_FORMS, EQUIPMENT_VALUE_TYPES } from "../config/infraEquipment.js";

// One equipment sheet row (src/config/infraEquipment.js): the block form once per block,
// the gp and misc forms once per GP (matched to BlockProfile.gps by LGD code).
// Values are checked by the controller against the form's fields. Editable after saving.
const valueFields = Object.fromEntries(
  Object.entries(EQUIPMENT_VALUE_TYPES).map(([key, type]) => [key, type === String ? { type, trim: true } : { type }])
);

const infraEquipmentSchema = new mongoose.Schema(
        {
                blockProfile: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "BlockProfile",
                        required: true
                },
                form: {
                        type: String,
                        enum: Object.keys(EQUIPMENT_FORMS),
                        required: true
                },
                gpLgdCode: {
                        type: String,
                        trim: true,
                        default: null
                },
                latitude: Number,
                longitude: Number,
                geoPhoto: mediaFileSchema,
                ...valueFields,
                // Misc sheets: one item per type of equipment at the site
                items: {
                        type: [
                                new mongoose.Schema(
                                        {
                                                type: { type: String, trim: true },
                                                assetCode: { type: String, trim: true },
                                                model: { type: String, trim: true },
                                                serialNo: { type: String, trim: true },
                                                // Taken on the mobile app, one per type
                                                geoPhoto: mediaFileSchema
                                        },
                                        { _id: false }
                                )
                        ],
                        default: undefined
                },
                // Misc sheets saved before items: one type, its LGD code (read via miscItemsOf)
                equipmentType: { type: String, trim: true },
                lgdCode: { type: String, trim: true },
                capturedBy: actorSchema,
                updatedBy: actorSchema
        },
        {
                timestamps: true,
                optimisticConcurrency: true,
                toJSON: withVersion
        }
);

infraEquipmentSchema.index({ blockProfile: 1, form: 1, gpLgdCode: 1 }, { unique: true });
infraEquipmentSchema.index({ assetCode: 1 }, { unique: true, sparse: true });

export default mongoose.model("InfraEquipment", infraEquipmentSchema, "InfraEquipment");

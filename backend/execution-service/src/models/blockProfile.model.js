import mongoose from "mongoose";

export const SITE_TYPES = ["BSNL_OWNED", "BSNL_RENTED", "OTHERS"];

// The Super Admin approval step will add PENDING_APPROVAL here.
export const BLOCK_PROFILE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"];

// Copied onto every section created under the block.
export const GEOGRAPHY_FIELDS = ["state", "stateCode", "district", "districtCode", "block", "blockCode"];

const isWholeNumber = (value) => value === undefined || value === null || Number.isInteger(value);

const COORDINATE_LIMITS = { latitude: 90, longitude: 180 };

// Optional coordinate that must come with its pair; `partner` reads the other half
const coordinate = (kind, label, partner) => {
        const other = kind === "latitude" ? "longitude" : "latitude";
        const limit = COORDINATE_LIMITS[kind];
        return {
                type: Number,
                required: [
                        function () {
                                return partner(this) != null;
                        },
                        `${label} ${kind} is required when ${other} is set`
                ],
                validate: {
                        validator: (value) => value >= -limit && value <= limit,
                        message: `Invalid ${kind}. Must be between -${limit} and ${limit}`
                }
        };
};

// Entered manually for now; a GP master will fill these in a later phase.
const gpSchema = new mongoose.Schema(
        {
                name: {
                        type: String,
                        trim: true,
                        required: [true, "GP name is required"]
                },
                lgdCode: {
                        type: String,
                        trim: true,
                        required: [true, "GP LGD code is required"]
                },
                latitude: coordinate("latitude", "GP", (gp) => gp.longitude),
                longitude: coordinate("longitude", "GP", (gp) => gp.latitude)
        },
        { _id: false }
);

// KML files live in S3; only their metadata is stored here.
const kmlFileSchema = new mongoose.Schema({
        name: {
                type: String,
                trim: true,
                required: [true, "KML file name is required"]
        },
        url: {
                type: String,
                trim: true,
                required: [true, "KML file URL is required"]
        },
        s3Key: {
                type: String,
                trim: true
        },
        sizeBytes: {
                type: Number,
                min: 0
        },
        uploadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
        },
        uploadedAt: {
                type: Date,
                default: Date.now
        }
});

const blockProfileSchema = new mongoose.Schema(
        {
                state: {
                        type: String,
                        trim: true
                },
                // LGD code
                stateCode: {
                        type: String,
                        trim: true
                },
                district: {
                        type: String,
                        trim: true
                },
                // LGD code
                districtCode: {
                        type: String,
                        trim: true
                },
                // BBNL asset codes use the Census district code, not the LGD one
                districtCensusCode: {
                        type: String,
                        trim: true
                },
                block: {
                        type: String,
                        trim: true,
                        required: [true, "Block is required"]
                },
                // LGD code
                blockCode: {
                        type: String,
                        trim: true,
                        required: [true, "Block LGD code is required"],
                        unique: true
                },
                siteType: {
                        type: String,
                        enum: {
                                values: SITE_TYPES,
                                message: "Site type must be one of " + SITE_TYPES.join(", ")
                        }
                },
                // Block headquarters: one per block, listed above its GPs
                bhq: {
                        name: {
                                type: String,
                                trim: true,
                                required: [true, "BHQ name is required"]
                        },
                        code: {
                                type: String,
                                trim: true,
                                required: [true, "BHQ code is required"]
                        },
                        latitude: coordinate("latitude", "BHQ", (doc) => doc.bhq?.longitude),
                        longitude: coordinate("longitude", "BHQ", (doc) => doc.bhq?.latitude)
                },
                numberOfGps: {
                        type: Number,
                        required: [true, "Number of GPs is required"],
                        min: [1, "Number of GPs must be at least 1"],
                        validate: {
                                validator: isWholeNumber,
                                message: "Number of GPs must be a whole number"
                        }
                },
                gps: {
                        type: [gpSchema],
                        default: [],
                        validate: {
                                validator: (gps) => new Set(gps.map((gp) => gp.lgdCode)).size === gps.length,
                                message: (props) => {
                                        const codes = props.value.map((gp) => gp.lgdCode);
                                        const duplicates = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];
                                        return `Duplicate GP LGD code: ${duplicates.join(", ")}`;
                                }
                        }
                },
                numberOfRacks: {
                        type: Number,
                        min: [0, "Number of racks can't be negative"],
                        validate: {
                                validator: isWholeNumber,
                                message: "Number of racks must be a whole number"
                        }
                },
                startDate: {
                        type: Date
                },
                endDate: {
                        type: Date,
                        validate: {
                                validator: function (value) {
                                        return !value || !this.startDate || value >= this.startDate;
                                },
                                message: "End date can't be before the start date"
                        }
                },
                remarks: {
                        type: String,
                        trim: true
                },
                blockRouter: {
                        latitude: coordinate("latitude", "Block router", (doc) => doc.blockRouter?.longitude),
                        longitude: coordinate("longitude", "Block router", (doc) => doc.blockRouter?.latitude),
                        address: {
                                type: String,
                                trim: true
                        }
                },
                kmlFiles: {
                        type: [kmlFileSchema],
                        default: []
                },
                // The demonstration block (POST /api/demo/block/reset): shown to ADMIN only
                isDemo: {
                        type: Boolean,
                        default: false
                },
                status: {
                        type: String,
                        enum: {
                                values: BLOCK_PROFILE_STATUSES,
                                message: "Status must be one of " + BLOCK_PROFILE_STATUSES.join(", ")
                        },
                        default: "ACTIVE"
                },
                createdBy: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User"
                },
                updatedBy: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User"
                }
        },
        {
                timestamps: true,
                id: false,
                toJSON: { virtuals: true },
                toObject: { virtuals: true }
        }
);

// Flag only: the declared count is never corrected to match the GP list
blockProfileSchema.virtual("gpCountMismatch").get(function () {
        return this.numberOfGps !== (this.gps || []).length;
});

blockProfileSchema.index({ district: 1, block: 1 });
blockProfileSchema.index({ status: 1 });

export default mongoose.model("BlockProfile", blockProfileSchema, "BlockProfile");

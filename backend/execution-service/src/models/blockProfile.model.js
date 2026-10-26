import mongoose from "mongoose";
import { assetPrefix } from "../config/infraEquipment.js";
import { TEAM_ROLES } from "../config/permissions.js";
import { actorSchema } from "./execution.schemas.js";

export const SITE_TYPES = ["BSNL_OWNED", "BSNL_RENTED", "OTHERS"];

// The Super Admin approval step will add PENDING_APPROVAL here.
export const BLOCK_PROFILE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"];

// Copied onto every section created under the block.
export const GEOGRAPHY_FIELDS = ["state", "stateCode", "district", "districtCode", "block", "blockCode"];

const isWholeNumber = (value) => value === undefined || value === null || Number.isInteger(value);

const COORDINATE_LIMITS = { latitude: 90, longitude: 180 };

// LGD codes have a fixed number of digits: state 2, district 3, block 4, GP 6
const digits = (count, label) => ({
        validator: (value) => value === undefined || value === null || value === "" || new RegExp(`^\\d{${count}}$`).test(value),
        message: `${label} must be ${count} digits`
});

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

// Filled in from the LGD master (lgdBlock.model.js) or entered by hand
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
                        required: [true, "GP LGD code is required"],
                        validate: digits(6, "GP LGD code")
                },
                latitude: coordinate("latitude", "GP", (gp) => gp.longitude),
                longitude: coordinate("longitude", "GP", (gp) => gp.latitude),
                // The ring this GP is on: one of the block's ring codes (checked on the block)
                ringCode: {
                        type: String,
                        trim: true,
                        uppercase: true
                }
        },
        { _id: false }
);

// Ring numbers follow the number of rings: A01, A02, … (ringCodes(3) -> A01, A02, A03). The
// stored ring code is SSDDDBBBBAAA: state, district and block LGD codes + the ring number.
export const MAX_RINGS = 20;
export const ringCodes = (count) => Array.from({ length: count }, (_, i) => `A${String(i + 1).padStart(2, "0")}`);
const RING_NUMBER = /A\d{2}$/;

// One ring of the block's network, named by its ring code
const ringSchema = new mongoose.Schema(
        {
                code: {
                        type: String,
                        trim: true,
                        uppercase: true,
                        required: [true, "Ring code is required"]
                }
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

// A user on the block's team. The name is copied from the auth service's user list.
const teamMemberSchema = new mongoose.Schema(
        {
                userId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                        required: [true, "Pick a user"]
                },
                name: {
                        type: String,
                        trim: true
                },
                role: {
                        type: String,
                        required: true,
                        enum: {
                                values: TEAM_ROLES,
                                message: "Team role must be one of " + TEAM_ROLES.join(", ")
                        }
                }
        },
        { _id: false }
);

const blockProfileSchema = new mongoose.Schema(
        {
                state: {
                        type: String,
                        trim: true
                },
                // LGD code
                stateCode: {
                        type: String,
                        trim: true,
                        validate: digits(2, "State LGD code")
                },
                district: {
                        type: String,
                        trim: true
                },
                // LGD code
                districtCode: {
                        type: String,
                        trim: true,
                        validate: digits(3, "District LGD code")
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
                        validate: digits(4, "Block LGD code"),
                        unique: true
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
                // The block's rings; each GP names the one it's on (gps.ringCode)
                rings: {
                        type: [ringSchema],
                        default: [],
                        validate: {
                                validator: (rings) => new Set(rings.map((r) => r.code)).size === rings.length,
                                message: "Each ring code can be used once"
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
                remarks: {
                        type: String,
                        trim: true
                },
                // The block's head node: sections start here and the block infra is captured here.
                // As a node it is { type: "ROUTER", code: blockCode } (utils/blockNodes.js).
                blockRouter: {
                        name: {
                                type: String,
                                trim: true
                        },
                        siteType: {
                                type: String,
                                enum: {
                                        values: SITE_TYPES,
                                        message: "Site type must be one of " + SITE_TYPES.join(", ")
                                }
                        },
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
                // The people working on this block; those with an assigned scope see only
                // the blocks they're on. A user is on the team once per role.
                team: {
                        type: [teamMemberSchema],
                        default: []
                },
                // Set by Admin: the whole block is read-only for everyone else from then on
                frozen: {
                        at: Date,
                        by: actorSchema
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

// Ring codes are SSDDDBBBB + the ring number, rebuilt on every save so they follow the block's
// codes; GPs keep their ring number. A GP's ring must then be one of the block's rings.
blockProfileSchema.pre("validate", function () {
        const prefix = assetPrefix(this);
        if (this.rings?.length) {
                if (!prefix) {
                        this.invalidate("numberOfRings", "Ring codes need the state, district and block LGD codes");
                } else {
                        this.rings = this.rings.map((r) => ({ code: `${prefix}${String(r.code).match(RING_NUMBER)?.[0] || r.code}` }));
                }
        }
        if (prefix) {
                (this.gps || []).forEach((gp) => {
                        const number = String(gp.ringCode || "").match(RING_NUMBER)?.[0];
                        if (number) gp.ringCode = `${prefix}${number}`;
                });
        }
        const codes = new Set((this.rings || []).map((r) => r.code));
        (this.gps || []).forEach((gp, index) => {
                if (gp.ringCode && !codes.has(gp.ringCode)) this.invalidate(`gps.${index}.ringCode`, `Ring ${gp.ringCode} isn't one of the block's rings`);
        });
});

// Flag only: the declared count is never corrected to match the GP list
blockProfileSchema.virtual("gpCountMismatch").get(function () {
        return this.numberOfGps !== (this.gps || []).length;
});

blockProfileSchema.index({ district: 1, block: 1 });
blockProfileSchema.index({ status: 1 });
blockProfileSchema.index({ "team.userId": 1 });

export default mongoose.model("BlockProfile", blockProfileSchema, "BlockProfile");

import mongoose from "mongoose";

// MediaFileSchema subdocument
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

// FieldSchema subdocument
const fieldSchema = new mongoose.Schema({
  sequence: {
    type: Number,
    required: [true, "Field sequence is required"]
  },
  key: {
    type: String,
    required: [true, "Field key is required"],
    trim: true
  },
  value: {
    type: String,
    trim: true
  },
  fieldType: {
    type: String,
    required: [true, "Field type is required"],
    enum: ["dropdown", "text"]
  },
  dropdownOptions: [{
    type: String,
    trim: true
  }],
  mediaFiles: [mediaFileSchema],
  status: {
    type: Number,
    default: 1
  }
}, { _id: true });

// ContactPerson subdocument
const contactPersonSchema = new mongoose.Schema({
  sdeName: {
    type: String,
    trim: true
  },
  sdeMobile: {
    type: String,
    trim: true
  },
  engineerName: {
    type: String,
    trim: true
  },
  engineerMobile: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  }
}, { _id: false });

// Main Survey Schema
const surveySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Survey name is required"],
    trim: true,
    minlength: [3, "Name must be at least 3 characters long"]
  },
  description: {
    type: String,
    required: [true, "Survey description is required"],
    trim: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    required: [true, "Location ID is required"]
  },
  stateName: {
    type: String,
    trim: true
  },
  stateCode: {
    type: String,
    trim: true
  },
  districtName: {
    type: String,
    trim: true
  },
  districtCode: {
    type: String,
    trim: true
  },
  blockName: {
    type: String,
    trim: true
  },
  blockCode: {
    type: String,
    trim: true
  },
  latitude: {
    type: String,
    required: [true, "Latitude is required"]
  },
  longitude: {
    type: String,
    required: [true, "Longitude is required"]
  },
  blockAddress: {
    type: String,
    trim: true
  },
  mediaFiles: [mediaFileSchema],
  contactPerson: contactPersonSchema,
  surveyType: {
    type: String,
    required: [true, "Survey type is required"],
    enum: ["block", "gp", "ofc"]
  },
  fields: [fieldSchema],
  status: {
    type: Number,
    default: 1
  },
  createdOn: {
    type: Date,
    required: [true, "Created date is required"],
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Creator is required"]
  },
  updatedOn: {
    type: Date,
    required: [true, "Updated date is required"],
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Updater is required"]
  },
  others: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
surveySchema.index({ locationId: 1 });
surveySchema.index({ surveyType: 1 });
surveySchema.index({ status: 1 });
surveySchema.index({ createdBy: 1 });
surveySchema.index({ createdOn: -1 });
surveySchema.index({ locationId: 1, surveyType: 1 });
surveySchema.index({ stateName: 1 });
surveySchema.index({ districtName: 1 });
surveySchema.index({ blockName: 1 });

// Pre-save middleware to update updatedOn
surveySchema.pre('save', function(next) {
  this.updatedOn = new Date();
  next();
});

surveySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedOn: new Date() });
  next();
});

// Static methods
surveySchema.statics.findByLocation = async function(locationId) {
  return this.find({ locationId, status: { $ne: 0 } });
};

surveySchema.statics.findByType = async function(surveyType) {
  return this.find({ surveyType, status: { $ne: 0 } });
};

surveySchema.statics.findByLocationAndType = async function(locationId, surveyType) {
  return this.find({ locationId, surveyType, status: { $ne: 0 } });
};

export default mongoose.model("Survey", surveySchema, "Survey");

import mongoose from 'mongoose';

const mediaFileSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  description: String,
  latitude: String,
  longitude: String,
  deviceName: String,
  accuracy: Number,
  place: String,
  source: {
    type: String,
    enum: ['mobile', 'web'],
    required: true
  }
}, { _id: false });

const contactPersonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  mobile: {
    type: String,
    required: true
  },
  description: String
}, { _id: false });

const FieldSchema = new mongoose.Schema({
  sequence: {
    type: Number,
    required: true
  },
  key: String,
  value: String,
  confirmation: {
    type: Boolean,
    default: false
  },
  remarks: String,
  status: {
    type: Number
  },
  others: {
    type: mongoose.Schema.Types.Mixed
  },
  mediaFiles: [mediaFileSchema]
}, { _id: false });

const hotoSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Location'
  },
  state: {
    type: String,
    default: 'kerala'
  },
  districtCode: {
    type: String,
    required: true
  },
  districtName: {
    type: String,
    required: true
  },
  blockCode: {
    type: String,
    required: true
  },
  blockName: {
    type: String,
    required: true
  },
  gpCode: String,
  gpName: String,
  ofcCode: String,
  ofcName: String,
  hotoType: {
    type: String,
    required: true,
    enum: ['block', 'ofc', 'gp']
  },
  remarks: String,
  latitude: String,
  longitude: String,
  status: {
    type: Number
  },
  others: {
    type: mongoose.Schema.Types.Mixed
  },
  contactPerson: contactPersonSchema,
  fields: [FieldSchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
hotoSchema.index({ locationId: 1 });
hotoSchema.index({ hotoType: 1 });
hotoSchema.index({ districtCode: 1 });
hotoSchema.index({ blockCode: 1 });
hotoSchema.index({ gpCode: 1 });
hotoSchema.index({ ofcCode: 1 });
hotoSchema.index({ status: 1 });
hotoSchema.index({ createdAt: -1 });

const Hoto = mongoose.model('Hoto', hotoSchema);

export default Hoto; 
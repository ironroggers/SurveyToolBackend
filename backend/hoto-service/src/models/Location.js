import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['district', 'block', 'gp', 'ofc'],
    required: true
  },
  coordinates: {
    latitude: String,
    longitude: String
  },
  parentLocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
locationSchema.index({ code: 1 });
locationSchema.index({ type: 1 });
locationSchema.index({ parentLocationId: 1 });

const Location = mongoose.model('Location', locationSchema);

export default Location; 
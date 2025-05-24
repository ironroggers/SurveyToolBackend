import mongoose from 'mongoose';

const hotoSchema = new mongoose.Schema({
  surveyId: {
    type: String,
    required: true
  },
  handoverBy: {
    type: String,
    required: true
  },
  takeoverBy: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String
  },
  handoverDate: {
    type: Date,
    default: Date.now
  },
  takeoverDate: {
    type: Date
  }
}, {
  timestamps: true
});

const HOTO = mongoose.model('HOTO', hotoSchema);
export default HOTO; 
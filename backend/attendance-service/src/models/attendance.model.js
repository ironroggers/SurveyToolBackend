import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'present'
    },
    checkInTime: {
      type: Date
    },
    checkOutTime: {
      type: Date
    },
    workHours: {
      type: Number
    },
    justification: {
      type: String,
      default: ''
    },
    justificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not_required'],
      default: 'not_required'
    },
    approvedBy: {
      type: String
    },
    location: {
      type: {
        latitude: Number,
        longitude: Number,
        address: String
      }
    }
  },
  {
    timestamps: true
  }
);

// Create a compound index on userId and date to ensure uniqueness
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance; 
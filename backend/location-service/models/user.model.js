import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phone: {
      type: Number,
    },
    role: {
      type: String,
      enum: ["SURVEYOR", "SUPERVISOR", "ADMIN"],
      required: true,
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Create the model using the existing collection name
export default mongoose.model("User", userSchema, "User"); 
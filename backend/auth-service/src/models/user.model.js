import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["SURVEYOR", "SUPERVISOR", "ADMIN"],
      required: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        // Make reportingTo required for all roles except ADMIN
        return this.role !== 'ADMIN';
      }
    },
    lastLogin: Date,
    status: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema, "User");

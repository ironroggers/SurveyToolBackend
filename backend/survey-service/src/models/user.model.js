import mongoose from "mongoose";

// This is a simplified version of the User schema used just for population
// The full model remains in the user-service
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    role: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("User", userSchema, "User"); 
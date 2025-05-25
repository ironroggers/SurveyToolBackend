import mongoose from "mongoose";

// This is a simplified version of the User schema used just for population
// The full model remains in the auth-service
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema, "User");

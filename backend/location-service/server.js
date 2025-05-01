import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import locationRoutes from "./routes/location.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

dotenv.config();

// Log environment variables (without exposing sensitive values)
console.log('Environment Variables Check:', {
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Missing',
  PORT: process.env.PORT || 3002
});

const app = express();

// Middleware
app.use(express.json({limit: '50mb'}));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.get("/health", (req, res) => {
  res.send(`Location Server is up and running!`);
});
app.use("/api/locations", locationRoutes);

// Error handling
app.use(errorHandler);

// Database connection
console.log("Attempting to connect to MongoDB...");
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB successfully!"))
  .catch((err) => {
    console.error("MongoDB connection error details:", {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack
    });
  });

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Location service running on port ${PORT}`);
});

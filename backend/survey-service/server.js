import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Import models first to ensure schemas are registered
import "./src/models/user.model.js";
import "./src/models/location.model.js";
import "./src/models/survey.model.js";

import surveyRoutes from "./src/routes/survey.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import { errorHandler } from "./src/middleware/error.middleware.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Survey Service is up and running!",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

app.use("/api/surveys", surveyRoutes);
app.use("/api/upload", uploadRoutes);

// Error handling
app.use(errorHandler);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/survey-db";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    console.log("Database:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Survey Service is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Base URL: http://localhost:${PORT}/api/surveys`);
});

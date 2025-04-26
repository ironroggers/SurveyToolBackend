import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Import models first to ensure schemas are registered
import "./src/models/user.model.js";
import "./src/models/location.model.js";

import surveyRoutes from "./src/routes/survey.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import { errorHandler } from "./src/middleware/error.middleware.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.get("/health", (req, res) => {
  res.send(`Survey Server is up and Running!`);
});
app.use("/api/surveys", surveyRoutes);
app.use("/api/upload", uploadRoutes);

// Error handling
app.use(errorHandler);

// Database connection - using local MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

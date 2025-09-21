import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Register models (ensure refs work when populating)
import "./src/models/section.model.js";
import "./src/models/subSection.model.js";
import "./src/models/trenching.model.js";

// Routes
import sectionRoutes from "./src/routes/section.routes.js";
import subSectionRoutes from "./src/routes/subsection.routes.js";
import trenchingRoutes from "./src/routes/trenching.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import aiRoutes from "./src/routes/ai.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Health
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "execution-service",
    timestamp: new Date().toISOString(),
  });
});

// Mount routes (auth intentionally bypassed for now)
app.use("/api/sections", sectionRoutes);
app.use("/api/subsections", subSectionRoutes);
app.use("/api/trenchings", trenchingRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/ai", aiRoutes);

// Global 404
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Connect DB and start server
const PORT = process.env.PORT || 3010;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/execution-db";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Execution service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

export default app;



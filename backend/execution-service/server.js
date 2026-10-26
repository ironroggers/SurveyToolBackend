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
import "./src/models/blockProfile.model.js";
import "./src/models/restoration.model.js";
import "./src/models/infraCapture.model.js";
import "./src/models/infraEquipment.model.js";
import "./src/models/mediaStamp.model.js";

// Routes
import sectionRoutes from "./src/routes/section.routes.js";
import subSectionRoutes from "./src/routes/subsection.routes.js";
import trenchingRoutes from "./src/routes/trenching.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import aiRoutes from "./src/routes/ai.routes.js";
import blockProfileRoutes from "./src/routes/blockProfile.routes.js";
import workRoutes from "./src/routes/work.routes.js";
import mediaRoutes from "./src/routes/media.routes.js";
import demoRoutes from "./src/routes/demo.routes.js";
import masterMapRoutes from "./src/routes/masterMap.routes.js";
import executionDashboardRoutes from "./src/routes/executionDashboard.routes.js";
import { DEMO_MEDIA_DIR, DEMO_MEDIA_ROUTE } from "./src/demo/demoMedia.js";
import { startStampWorker } from "./src/services/stampQueue.service.js";
import { requireAuth } from "./src/midddleware/actor.middleware.js";

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

// Generated photos, videos and KML of the demo block; the web portal loads them cross-origin
// (as <img> / <video>, which can't send the token)
app.use(DEMO_MEDIA_ROUTE, express.static(DEMO_MEDIA_DIR, { setHeaders: (res) => res.set("Cross-Origin-Resource-Policy", "cross-origin") }));

// Everything below needs the auth-service login token; who is acting comes from it
app.use("/api", requireAuth);
app.use("/api/sections", sectionRoutes);
app.use("/api/subsections", subSectionRoutes);
app.use("/api/trenchings", trenchingRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/block-profiles", blockProfileRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/demo", demoRoutes);
app.use("/api/master-map", masterMapRoutes);
app.use("/api/execution-dashboard", executionDashboardRoutes);
app.use("/api", workRoutes);

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
    // Burns the location stamp into uploaded photos and videos in the background
    startStampWorker().catch((err) => console.error("[stamp] worker didn't start:", err.message));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

export default app;



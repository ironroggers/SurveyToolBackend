import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import attendanceRoutes from "./src/routes/attendance.routes.js";
import { errorHandler } from "./src/middleware/error.middleware.js";
import { authMiddleware } from "./src/middleware/auth.middleware.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.get("/health", (req, res) => {
  res.send(`Attendance Service is up and running!`);
});
app.use("/api/attendance", authMiddleware, attendanceRoutes);

// Error handling
app.use(errorHandler);

// Database connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Attendance service running on port ${PORT}`);
}); 
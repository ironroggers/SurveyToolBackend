import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import blockHOTO from "./src/routes/blockhoto.routes.js";
import gphoto from "./src/routes/gphoto.routes.js";
import ofchoto from "./src/routes/ofchoto.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./src/middleware/errorHandlers.js";
import initializeDB from "./initializeDB.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "hoto-service",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

app.use("/api/blockhoto", blockHOTO);
app.use("/api/gphoto", gphoto);
app.use("/api/ofchoto", ofchoto);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
let server;

const startServer = async () => {
  try {
    await initializeDB();
    server = app.listen(PORT, () => {
      console.log(`HOTO Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();

import dotenv from "dotenv";

export function loadEnv() {
  const result = dotenv.config();
  if (result.error && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[summary-service] .env not found, relying on process env");
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/test",
  logLevel: process.env.LOG_LEVEL || "info",
};

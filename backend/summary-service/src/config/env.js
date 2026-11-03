import dotenv from "dotenv";

export function loadEnv() {
  const result = dotenv.config();
  if (result.error && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[summary-service] .env not found, relying on process env");
  }
}

// Read when used, not when this file is imported: imports run before server.js calls
// loadEnv(), so values from .env aren't there yet at import time
export const config = {
  get nodeEnv() {
    return process.env.NODE_ENV || "development";
  },
  get port() {
    return process.env.PORT || 5000;
  },
  get mongoUri() {
    return process.env.MONGODB_URI || "mongodb://localhost:27017/test";
  },
  get logLevel() {
    return process.env.LOG_LEVEL || "info";
  },
};

import fs from "fs/promises";
import path from "path";

// Placeholder: in real service, aggregate from other microservices/models
export async function getSummary() {
  const samplePath = path.resolve(process.cwd(), "sampleSummary.json");
  try {
    const content = await fs.readFile(samplePath, "utf8");
    const sample = JSON.parse(content);
    return {
      sample,
    };
  } catch (e) {
    const error = new Error("SUMMARY_NOT_AVAILABLE");
    error.status = 404;
    error.code = "SUMMARY_NOT_AVAILABLE";
    throw error;
  }
}

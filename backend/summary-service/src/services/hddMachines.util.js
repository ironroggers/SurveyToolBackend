import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCSVLine } from "./csvParser.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getHddMachines() {
  try {
    // Read the CSV file
    const csvFilePath = path.join(__dirname, "./sheetData/HDD_Machines.csv");
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");

    // Parse CSV
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");

    // Find column indices
    const deploymentDateIndex = headers.findIndex(
      (h) => h.trim() === "Deployment Date"
    );
    const hddNoIndex = headers.findIndex((h) => h.trim() === "HDD NO");
    const underSupervisionIndex = headers.findIndex(
      (h) => h.trim() === "Under Supervision & Number"
    );

    // Parse data rows
    const hddData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Handle potential commas within quoted fields
      const row = parseCSVLine(line);

      if (
        row.length >
        Math.max(deploymentDateIndex, hddNoIndex, underSupervisionIndex)
      ) {
        hddData.push({
          deployment_date: row[deploymentDateIndex]?.trim() || "",
          hdd_machine_id: row[hddNoIndex]?.trim() || "",
          operator_name: row[underSupervisionIndex]?.trim() || "",
        });
      }
    }

    return hddData;
  } catch (error) {
    console.error("Error reading HDD machines data:", error);
    return [];
  }
}


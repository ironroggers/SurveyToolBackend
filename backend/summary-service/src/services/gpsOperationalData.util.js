import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCSVLine } from "./csvParser.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getGpsOperationalData() {
  try {
    // Read the CSV file
    const csvFilePath = path.join(
      __dirname,
      "../../Kerala Project_ PM tool Dashboard - GP Operational Status.csv"
    );
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");

    // Parse CSV
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");

    // Find column indices
    const districtIndex = headers.findIndex((h) => h.trim() === "DISTRICT");
    const blockIndex = headers.findIndex((h) => h.trim() === "BLOCK");
    const blockCodeIndex = headers.findIndex((h) => h.trim() === "Block Code");
    const locationCodeIndex = headers.findIndex(
      (h) => h.trim() === "LOCATION CODE"
    );
    const ontLocationNameIndex = headers.findIndex(
      (h) => h.trim() === "ONT LOCATION NAME"
    );
    const ontAvailabilityIndex = headers.findIndex(
      (h) => h.trim() === "ONT AVAILABILITY(%)"
    );

    const hotoStatusIndex = headers.findIndex(
      (h) => h.trim() === "HOTO Status"
    );
    const gpRouterInstalledIndex = headers.findIndex(
      (h) => h.trim() === "GP Router Installed(Yes/No)"
    );
    const visibilityInSnocIndex = headers.findIndex(
      (h) => h.trim() === "Visibility in SNOC(Yes/ No)"
    );

    // Parse data rows
    const gpsData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Handle potential commas within quoted fields
      const row = parseCSVLine(line);

      if (
        row.length >
        Math.max(
          districtIndex,
          blockIndex,
          blockCodeIndex,
          locationCodeIndex,
          ontLocationNameIndex,
          ontAvailabilityIndex,
          hotoStatusIndex,
          gpRouterInstalledIndex,
          visibilityInSnocIndex
        )
      ) {
        gpsData.push({
          District_Name: row[districtIndex]?.trim() || "",
          Block_Name: row[blockIndex]?.trim() || "",
          Block_Code: row[blockCodeIndex]?.trim() || "",
          lgd_code: row[locationCodeIndex]?.trim() || "",
          gp_name: row[ontLocationNameIndex]?.trim() || "",
          ONT_Availability: row[ontAvailabilityIndex]?.trim() || "",
          Hoto_Status: row[hotoStatusIndex]?.trim() || "",
          Hoto_Date: new Date("2025-07-31").toISOString().split("T")[0],
          GP_Router_Installed: row[gpRouterInstalledIndex]?.trim() || "",
          Visibility_in_SNOC: row[visibilityInSnocIndex]?.trim() || "",
        });
      }
    }

    return gpsData;
  } catch (error) {
    console.error("Error reading GPS operational data:", error);
    return [];
  }
}

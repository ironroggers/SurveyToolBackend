import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCSVLine } from "./csvParser.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getBlockRouters() {
  try {
    // Read the CSV file
    const csvFilePath = path.join(__dirname, "../../Block_Routers.csv");
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");

    // Parse CSV
    const lines = csvContent.split("\n");

    // Parse the header using the CSV parser to handle quoted fields
    const headerRow = parseCSVLine(lines[0]);

    // Find column indices
    const districtIndex = headerRow.findIndex((h) => h.trim() === "District");
    const blockIndex = headerRow.findIndex((h) => h.trim() === "Block");
    const blockCodeIndex = headerRow.findIndex(
      (h) => h.trim() === "Block Code"
    );
    const blockRouterInstalledIndex = headerRow.findIndex(
      (h) => h.trim() === "Block Router Installed (Yes/No)"
    );

    // Parse data rows (starting from line 1)
    const blockRoutersData = [];
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
          blockRouterInstalledIndex
        )
      ) {
        blockRoutersData.push({
          District_Name: row[districtIndex]?.trim() || "",
          Block_Name: row[blockIndex]?.trim() || "",
          Block_Code: row[blockCodeIndex]?.trim() || "",
          Block_Router_Installed: row[blockRouterInstalledIndex]?.trim() || "",
        });
      }
    }

    return blockRoutersData;
  } catch (error) {
    console.error("Error reading block routers data:", error);
    return [];
  }
}

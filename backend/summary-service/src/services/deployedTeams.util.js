import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCSVLine } from "./csvParser.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDeployedTeams() {
  try {
    // Read the CSV file
    const csvFilePath = path.join(__dirname, "./sheetData/deployed_teams.csv");
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");

    // Parse CSV
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");

    // Find column indices
    const projectIndex = headers.findIndex((h) => h.trim() === "PROJECT");
    const payrollIndex = headers.findIndex((h) => h.trim() === "PAY ROLL");
    const empCodeIndex = headers.findIndex((h) => h.trim() === "EMP. CODE");
    const nameIndex = headers.findIndex((h) => h.trim() === "NAME OF EMPLOYEE");
    const designationIndex = headers.findIndex(
      (h) => h.trim() === "Designation"
    );
    const roleIndex = headers.findIndex((h) => h.trim() === "Role");
    const headIndex = headers.findIndex((h) => h.trim() === "HEAD");

    // Parse data rows
    const teamsData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Handle potential commas within quoted fields
      const row = parseCSVLine(line);

      if (
        row.length >
        Math.max(
          projectIndex,
          payrollIndex,
          empCodeIndex,
          nameIndex,
          designationIndex,
          roleIndex,
          headIndex
        )
      ) {
        teamsData.push({
          project: row[projectIndex]?.trim() || "",
          payroll: row[payrollIndex]?.trim() || "",
          emp_code: row[empCodeIndex]?.trim() || "",
          name: row[nameIndex]?.trim() || "",
          designation: row[designationIndex]?.trim() || "",
          role: row[roleIndex]?.trim() || "",
          head: row[headIndex]?.trim() || "",
        });
      }
    }

    return teamsData;
  } catch (error) {
    console.error("Error reading deployed teams data:", error);
    return [];
  }
}


import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCSVLine } from "./csvParser.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDesktopSurveys() {
  try {
    // Read the CSV file
    const csvFilePath = path.join(__dirname, "./sheetData/desktop_surveys.csv");
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");

    // Parse CSV
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");

    // Find column indices
    const districtNameIndex = headers.findIndex(
      (h) => h.trim() === "District name"
    );
    const blockNameIndex = headers.findIndex((h) => h.trim() === "BLOCK NAME");
    const blockCodeIndex = headers.findIndex(
      (h) => h.trim() === "Block LGD Code"
    );
    const lgdCodeIndex = headers.findIndex((h) => h.trim() === "LGD CODE");
    const gpNameIndex = headers.findIndex((h) => h.trim() === "GP Name");
    const submittedIndex = headers.findIndex(
      (h) => h.trim() === "KML Submitted to BSNL through mail (Yes/No)"
    );
    const approvedIndex = headers.findIndex(
      (h) => h.trim() === "BSNL KML Acceptance"
    );
    const physicalSurveyStatusIndex = headers.findIndex(
      (h) => h.trim() === "Physical survey status"
    );
    const physicalSurveyApprovedIndex = headers.findIndex(
      (h) => h.trim() === "Physical Survey Approved (Yes/No)"
    );
    const boqSubmittedIndex = headers.findIndex(
      (h) => h.trim() === "BOQ Submitted"
    );
    const boqApprovedIndex = headers.findIndex(
      (h) => h.trim() === "BOQ Approved"
    );

    // Parse data rows
    const surveysData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Handle potential commas within quoted fields
      const row = parseCSVLine(line);

      if (
        row.length >
        Math.max(
          districtNameIndex,
          blockNameIndex,
          blockCodeIndex,
          lgdCodeIndex,
          gpNameIndex,
          submittedIndex,
          approvedIndex,
          physicalSurveyStatusIndex,
          physicalSurveyApprovedIndex,
          boqSubmittedIndex,
          boqApprovedIndex
        )
      ) {
        surveysData.push({
          District_Name: row[districtNameIndex]?.trim() || "",
          Block_Name: row[blockNameIndex]?.trim() || "",
          Block_Code: row[blockCodeIndex]?.trim() || "",
          Lgd_Code: row[lgdCodeIndex]?.trim() || "",
          Gp_Name: row[gpNameIndex]?.trim() || "",
          Submitted: row[submittedIndex]?.trim() || "",
          Approved: row[approvedIndex]?.trim() || "",
          Physical_Survey_Status: row[physicalSurveyStatusIndex]?.trim() || "",
          Physical_Survey_Approved:
            row[physicalSurveyApprovedIndex]?.trim() || "",
          Boq_Submitted: row[boqSubmittedIndex]?.trim() || "",
          Boq_Approved: row[boqApprovedIndex]?.trim() || "",
        });
      }
    }

    return surveysData;
  } catch (error) {
    console.error("Error reading desktop surveys data:", error);
    return [];
  }
}

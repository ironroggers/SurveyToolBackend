import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Summary from "../models/summaryModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/surveydb";

function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > 0) {
      const rowData = {};
      headers.forEach((header, index) => {
        const value = values[index] || "";
        rowData[header] =
          typeof value === "string" ? value.trim() : String(value).trim();
      });
      rows.push(rowData);
    }
  }

  return { headers, rows };
}

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

function inferFieldType(values) {
  const nonEmptyValues = values.filter(
    (v) => v !== "" && v !== null && v !== undefined
  );

  if (nonEmptyValues.length === 0) return "string";

  try {
    const allNumbers = nonEmptyValues.every((v) => !isNaN(v) && v !== "");
    if (allNumbers) return "number";

    const datePattern =
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$|^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/;
    const allDates = nonEmptyValues.every((v) => datePattern.test(String(v)));
    if (allDates) return "date";

    const booleanValues = ["yes", "no", "true", "false", "y", "n"];
    const allBoolean = nonEmptyValues.every((v) => {
      const str = String(v || "").toLowerCase();
      return booleanValues.includes(str);
    });
    if (allBoolean) return "boolean";
  } catch (error) {
    console.warn("Warning: Error during type inference, defaulting to string");
  }

  return "string";
}

function convertValue(value, fieldType) {
  if (value === null || value === undefined || value === "") return value;

  try {
    switch (fieldType) {
      case "number":
        const num = Number(value);
        return isNaN(num) ? value : num;

      case "boolean":
        const lower = String(value || "").toLowerCase();
        if (["yes", "true", "y", "1"].includes(lower)) return true;
        if (["no", "false", "n", "0"].includes(lower)) return false;
        return value;

      case "date":
        try {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date;
        } catch {
          return value;
        }

      default:
        return value;
    }
  } catch (error) {
    console.warn(`Warning: Could not convert value "${value}" to ${fieldType}`);
    return value;
  }
}

function generateFieldDefinitions(headers, rows) {
  const fields = [];

  headers.forEach((header, index) => {
    const sampleValues = rows.slice(0, 100).map((row) => {
      const values = Object.values(row);
      return values[index];
    });

    const fieldType = inferFieldType(sampleValues);

    fields.push({
      fieldName: header,
      fieldType: fieldType,
      isRequired: false,
      description: `Field: ${header}`,
    });
  });

  return fields;
}

async function processCsvFile(filePath, sheetName) {
  console.log(`\n📄 Processing ${sheetName}...`);

  const { headers, rows } = parseCSV(filePath);

  if (rows.length === 0) {
    console.log(`⚠️  No data found in ${sheetName}`);
    return 0;
  }

  console.log(`   Found ${rows.length} rows and ${headers.length} columns`);

  console.log(`   Creating documents...`);
  const documents = rows.map((row, index) => {
    if (rows.length > 500 && (index + 1) % 200 === 0) {
      process.stdout.write(`   Progress: ${index + 1}/${rows.length} rows\r`);
    }

    return {
      sheetName: sheetName,
      rowData: row,
      rowNumber: index + 1,
      others: {
        source: path.basename(filePath),
        importedAt: new Date(),
      },
    };
  });

  if (rows.length > 500) {
    process.stdout.write(`   Progress: ${rows.length}/${rows.length} rows\n`);
  }

  console.log(`   Inserting into database...`);
  const result = await Summary.insertMany(documents, {
    ordered: false,
    rawResult: false,
  });
  console.log(`✅ Inserted ${result.length} documents for ${sheetName}`);

  return result.length;
}

async function seedDatabase() {
  try {
    console.log("🚀 Starting database seeding...\n");

    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("🗑️  Clearing existing data...");
    await Summary.deleteMany({});
    console.log("✅ Cleared existing data\n");

    const csvFiles = [
      {
        fileName: "HDD_Machines.csv",
        sheetName: "HDD Machines",
      },
      {
        fileName: "Gp_operational.csv",
        sheetName: "GP Operational Data",
      },
      {
        fileName: "desktop_surveys.csv",
        sheetName: "Desktop Surveys",
      },
      {
        fileName: "deployed_teams.csv",
        sheetName: "Deployed Teams",
      },
      {
        fileName: "Block_Routers.csv",
        sheetName: "Block Routers",
      },
    ];

    let totalInserted = 0;

    for (const csvFile of csvFiles) {
      const filePath = path.join(
        __dirname,
        "../services/sheetData",
        csvFile.fileName
      );

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${csvFile.fileName}`);
        continue;
      }

      try {
        const inserted = await processCsvFile(filePath, csvFile.sheetName);
        totalInserted += inserted;
      } catch (error) {
        console.error(
          `❌ Error processing ${csvFile.fileName}:`,
          error.message
        );
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 SEEDING SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Total documents inserted: ${totalInserted}`);

    const sheetNames = await Summary.getSheetNames();
    console.log(`📑 Sheets created: ${sheetNames.length}`);
    sheetNames.forEach((name) => {
      console.log(`   - ${name}`);
    });

    console.log("\n📈 Row counts per sheet:");
    for (const name of sheetNames) {
      const count = await Summary.countDocuments({ sheetName: name });
      console.log(`   - ${name}: ${count} rows`);
    }

    console.log("\n✨ Database seeding completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Error during seeding:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("\n✅ Seeding process finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Seeding process failed:", error);
      process.exit(1);
    });
}

export default seedDatabase;

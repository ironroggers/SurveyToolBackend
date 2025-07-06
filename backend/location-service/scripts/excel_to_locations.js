// import fs from "fs";
// import path from "path";
// import xlsx from "xlsx";
// import { fileURLToPath } from "url";

// /**
//  * Usage:
//  *   node scripts/excel_to_locations.js <path-to-excel-file> [output-json-file]
//  *
//  * The script reads the first worksheet of the given Excel workbook and converts
//  * each District/Block group into a Location-compatible JSON object (see
//  * backend/location-service/models/location.model.js).
//  *
//  * For every distinct District + Block combination we create a location object
//  * with a `route` array populated from the "From" column.
//  *   – The first "From" entry per block is marked with type "BHQ".
//  *   – All subsequent entries are marked with type "GP".
//  * The latitude and longitude columns are expected to be named "Lat" and
//  * "Long" (case-sensitive). Empty cells for District or Block are filled using
//  * the last known non-empty value, because the sheet uses merged cells.
//  */

// // Helper to get current directory in ESM
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// function main() {
//   // CLI: node scripts/excel_to_locations.js <excel-file> [output-json-file]
//   // If excel-file is omitted we default to the XLSX that sits next to this script.

//   const [cliExcelPath, cliOutputPath] = process.argv.slice(2);

//   const defaultExcel = path.join(
//     __dirname,
//     "Bharat Net Phase - III Kerala 58 Blocks Length.xlsx"
//   );
//   const defaultOutput = path.join(__dirname, "locations.json");

//   const excelFile = cliExcelPath ? path.resolve(cliExcelPath) : defaultExcel;
//   const outFile = cliOutputPath ? path.resolve(cliOutputPath) : defaultOutput;

//   if (!fs.existsSync(excelFile)) {
//     console.error(`Excel file not found: ${excelFile}`);
//     process.exit(1);
//   }

//   const workbook = xlsx.readFile(excelFile);
//   const sheetName = workbook.SheetNames[0];
//   const worksheet = workbook.Sheets[sheetName];

//   // Read the sheet into JSON while preserving empty cells (defval: "").
//   const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

//   const locationMap = {};
//   let currentDistrict = "";
//   let currentBlock = "";

//   rows.forEach((row) => {
//     // Propagate merged-cell values.
//     if (row["District"]) currentDistrict = String(row["District"]).trim();
//     if (row["Block"]) currentBlock = String(row["Block"]).trim();

//     const district = currentDistrict;
//     const block = currentBlock;
//     if (!district || !block) return; // Skip rows until both are defined.

//     const place = String(row["From"] || row["from"] || "").trim();
//     if (!place) return; // Skip rows without a "From" value.

//     const latitude = parseFloat(row["Lat"] || row["lat"]);
//     const longitude = parseFloat(row["Long"] || row["long"]);
//     if (Number.isNaN(latitude) || Number.isNaN(longitude)) return; // skip invalid

//     const key = `${district}__${block}`;
//     if (!locationMap[key]) {
//       locationMap[key] = {
//         state: "Kerala",
//         state_code: "KL",
//         district,
//         district_code: "dummy_code",
//         district_address: "dummy_address",
//         block,
//         route: [],
//       };
//     }

//     const routeType = locationMap[key].route.length === 0 ? "BHQ" : "GP";

//     locationMap[key].route.push({
//       place,
//       latitude,
//       longitude,
//       type: routeType,
//     });
//   });

//   // Append the first route point as the last point (to close the loop)
//   const locations = Object.values(locationMap);
//   locations.forEach((loc) => {
//     if (loc.route && loc.route.length > 0) {
//       loc.route.push({ ...loc.route[0] });
//     }
//   });

//   const json = JSON.stringify(locations, null, 2);

//   fs.writeFileSync(outFile, json, "utf8");
//     console.log(`Wrote ${locations.length} locations to ${outFile}`);
// }

// main();

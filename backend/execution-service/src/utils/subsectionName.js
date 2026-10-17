import { EXECUTION_TYPES } from "../config/executionTypes.js";

// TODO(confirm): name format ROAD-TYPE-NNN, e.g. NH66-HDD-007
export const roadSlug = (road) =>
  String(road || "")
    .toUpperCase()
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bJUNCTION\b/g, "JN")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14);

export const subsectionName = (roadName, typeOfWork, seq) =>
  `${roadSlug(roadName) || "ROAD"}-${EXECUTION_TYPES[typeOfWork]?.code || "TYPE"}-${String(seq).padStart(3, "0")}`;

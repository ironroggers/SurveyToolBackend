// Equipment sheets filled on the web portal after a block is created: Block_eqpt once
// per block, gp_eqpt once per GP, misc_eqpt once per block and once per GP. `levels`
// says where each sheet can be filled. `column` is the sheet's column name,
// kept for exports. State, district and block names and codes are not stored here:
// they come from the block profile.
//
// Field types: text, int (whole number ≥ 0), metres (number ≥ 0), enum, ip, mac.
// latitude / longitude / geoPhoto are handled by the controller on every form.

export const PHASES = ["1", "2", "ABP"];
export const PROJECT_STATUSES = ["DESIGNED", "EXECUTED"];
export const BACKHAUL = ["F", "S", "R"]; // OFC / Satellite / Radio
// Asset code XX for each misc equipment type
export const MISC_TYPE_TAGS = { RACK: "RA", FDMS: "FD", FTB: "FT", CCU: "CC", SPV: "SP" };
export const GP_SITE_TYPES = ["SCHOOL", "COLLEGE", "AANGANWADI", "GRAM_PANCHAYAT_BHAVAN"];

const common = {
  phase: { column: "phase", type: "enum", options: PHASES, required: true },
  assetCode: { column: "asset_code", type: "text", required: true },
  projectStatus: { column: "proj_statu", type: "enum", options: PROJECT_STATUSES, required: true },
  remarks: { column: "remarks", type: "text" },
};

export const EQUIPMENT_FORMS = {
  block: {
    levels: ["BLOCK"],
    sheet: "Block_eqpt",
    fields: {
      phase: common.phase,
      siteType: { column: "site_type", type: "enum", options: ["BSNL_OWNED", "BSNL_RENTED", "OTHERS"] },
      assetCode: common.assetCode,
      routerType: { column: "router_typ", type: "enum", options: ["A", "B"] },
      make: { column: "eqp_make", type: "text" },
      model: { column: "eqp_model", type: "text" },
      managementIp: { column: "eqp_mgm_ip", type: "ip" },
      macId: { column: "eqp_mac_id", type: "mac" },
      serialNo: { column: "eqp_sr_no", type: "text" },
      ports100g: { column: "Port_100g", type: "int" },
      ports10g: { column: "Port_10g", type: "int" },
      ports10g1g: { column: "Port_10g_1g", type: "int" },
      projectStatus: common.projectStatus,
      remarks: common.remarks,
    },
  },
  gp: {
    levels: ["GP"],
    sheet: "gp_eqpt",
    fields: {
      phase: common.phase,
      locationType: { column: "loc_type", type: "enum", options: ["GP", "VILLAGE", "SEMI_URBAN"] },
      locationName: { column: "loc_name", type: "text" },
      locationCode: { column: "loc_code", type: "text" },
      routerType: { column: "router_typ", type: "enum", options: ["C", "D"] },
      ringCount: { column: "ring_count", type: "int" },
      ringCode: { column: "ring_code", type: "text" },
      assetCode: common.assetCode,
      siteType: { column: "site_type", type: "enum", options: GP_SITE_TYPES },
      managementIp: { column: "eqp_mng_ip", type: "ip" },
      prevNode: { column: "pv_loc_nod", type: "text" },
      prevNodeDistanceM: { column: "pv_nod_dis", type: "metres" },
      nextNode: { column: "nx_loc_nod", type: "text" },
      nextNodeDistanceM: { column: "nx_nod_dis", type: "metres" },
      macId: { column: "eqp_mac_id", type: "mac" },
      serialNo: { column: "eqp_sr_no", type: "text" },
      ports1g: { column: "Port_1g", type: "int" },
      ports10g: { column: "Port_10g", type: "int" },
      ports10g1g: { column: "Port_10g_1g", type: "int" },
      backhaul: { column: "backhaul", type: "enum", options: BACKHAUL },
      model: { column: "eqp_model", type: "text" },
      make: { column: "eqp_make", type: "text" },
      projectStatus: common.projectStatus,
      remarks: common.remarks,
    },
  },
  misc: {
    levels: ["BLOCK", "GP"],
    sheet: "misc_eqpt",
    fields: {
      phase: common.phase,
      equipmentType: { column: "type", type: "enum", options: Object.keys(MISC_TYPE_TAGS), required: true },
      lgdCode: { column: "lgd_code", type: "text" },
      assetCode: common.assetCode,
      model: { column: "ms_eq_modl", type: "text" },
      locationType: { column: "loc_type", type: "enum", options: GP_SITE_TYPES },
      serialNo: { column: "ms_eqp_sn", type: "text" },
      backhaul: { column: "backhaul", type: "enum", options: BACKHAUL },
      projectStatus: common.projectStatus,
      remarks: common.remarks,
    },
  },
};

// Every value key across the forms, with its stored type
export const EQUIPMENT_VALUE_TYPES = Object.fromEntries(
  Object.values(EQUIPMENT_FORMS).flatMap((form) =>
    Object.entries(form.fields).map(([key, field]) => [key, field.type === "int" || field.type === "metres" ? Number : String])
  )
);

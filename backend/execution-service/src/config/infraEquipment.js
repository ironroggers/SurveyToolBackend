// Equipment sheets filled on the web portal after a block is created: Block_eqpt once
// per block, gp_eqpt once per GP, misc_eqpt once per block and once per GP. `levels`
// says where each sheet can be filled. `column` is the sheet's column name,
// kept for exports. State, district and block names and codes are not stored here:
// they come from the block profile.
//
// Field types: text, int (whole number ≥ 0), metres (number ≥ 0), enum, ip, mac.
// latitude / longitude / geoPhoto are handled by the controller on every form. The geo
// photo is taken on the mobile app (PUT …/equipment/:form/geo-photo); the web shows it.

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
      // Generated from the block profile: blockAssetCode()
      assetCode: common.assetCode,
      routerType: { column: "router_typ", type: "enum", options: ["A", "B"] },
      make: { column: "eqp_make", type: "text" },
      model: { column: "eqp_model", type: "text" },
      managementIp: { column: "eqp_mgm_ip", type: "ip" },
      macId: { column: "eqp_mac_id", type: "mac" },
      serialNo: { column: "eqp_sr_no", type: "text" },
      // Ports by speed and optic reach
      ports100g40km: { column: "Port_100g_40km", type: "int" },
      ports10g10km: { column: "Port_10g_10km", type: "int" },
      ports10g40km: { column: "Port_10g_40km", type: "int" },
      ports10g80km: { column: "Port_10g_80km", type: "int" },
      ports1g10km: { column: "Port_1g_10km", type: "int" },
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
  // One sheet per site holding one item per type of equipment there (MISC_ITEM_FIELDS);
  // the site's LGD code comes from the GP or block, so the sheet doesn't ask for it
  misc: {
    levels: ["BLOCK", "GP"],
    sheet: "misc_eqpt",
    items: true,
    fields: {
      phase: common.phase,
      // Once for the sheet, not per item
      locationType: { column: "loc_type", type: "enum", options: GP_SITE_TYPES },
      backhaul: { column: "backhaul", type: "enum", options: BACKHAUL },
      remarks: common.remarks,
    },
  },
};

const pad = (value, length) => {
  const text = String(value ?? "").trim();
  return text ? text.padStart(length, "0") : "";
};

// SS (state LGD) + DDD (district LGD) + BBBB (block LGD); empty if a code is missing
export const assetPrefix = (profile) => {
  const parts = [pad(profile.stateCode, 2), pad(profile.districtCode, 3), pad(profile.blockCode, 4)];
  return parts.every(Boolean) ? parts.join("") : "";
};

// The block router's asset code: SSDDDBBBB + BH + LL, fixed
export const blockAssetCode = (profile) => {
  const prefix = assetPrefix(profile);
  return prefix ? `${prefix}BHLL`.toUpperCase().replace(/\s+/g, "") : "";
};

// A misc sheet's items: one per type, each with its generated asset code
export const MISC_ITEM_FIELDS = {
  type: { column: "type", type: "enum", options: Object.keys(MISC_TYPE_TAGS) },
  assetCode: { column: "asset_code", type: "text" },
  model: { column: "ms_eq_modl", type: "text" },
  serialNo: { column: "ms_eqp_sn", type: "text" },
};

// SSDDDBBBB + type tag (RA, FD, FT, CC, SP) + the site's LGD code in 6 digits
export const miscAssetCode = (profile, lgdCode, type) => {
  const prefix = assetPrefix(profile);
  return prefix && MISC_TYPE_TAGS[type] ? `${prefix}${MISC_TYPE_TAGS[type]}${pad(lgdCode, 6)}`.toUpperCase().replace(/\s+/g, "") : "";
};

// A misc record's items; a sheet saved before items existed has one type at the top level
export const miscItemsOf = (record) =>
  record?.items?.length
    ? record.items
    : record?.equipmentType
      ? [{ type: record.equipmentType, assetCode: record.assetCode, model: record.model, serialNo: record.serialNo }]
      : [];

// Every value key across the forms, with its stored type
export const EQUIPMENT_VALUE_TYPES = Object.fromEntries(
  Object.values(EQUIPMENT_FORMS).flatMap((form) =>
    Object.entries(form.fields).map(([key, field]) => [key, field.type === "int" || field.type === "metres" ? Number : String])
  )
);

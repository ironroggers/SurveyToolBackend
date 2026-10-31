// Who can do what with block profiles and OFC execution. This is the only copy of
// the matrix: the web portal and the mobile app read it from GET /api/permissions
// (or /api/block-profiles/permissions), and the routes check the same actions
// against the signed-in user (src/services/access.service.js).

export const ROLES = [
  "ADMIN",
  "ZONAL MANAGER",
  "CLUSTER HEAD",
  "GIS HEAD",
  "FIELD EXECUTIVE",
  "SUPERVISOR",
  "VIEWER",
  "SURVEYOR",
];

// Roles assigned to a block profile's team. Admin assigns Zonal Managers; a Zonal
// Manager assigns the others.
export const TEAM_ROLES = ["ZONAL MANAGER", "CLUSTER HEAD", "GIS HEAD", "FIELD EXECUTIVE"];

// action -> role -> scope. A role missing from an action is not allowed.
//   all:      every block
//   assigned: only blocks whose team the user is on
// Frozen sections and blocks stay read-only for everyone but ADMIN, whatever the action.
const VIEWERS = {
  ADMIN: "all",
  SUPERVISOR: "all",
  VIEWER: "all",
  "ZONAL MANAGER": "assigned",
  "CLUSTER HEAD": "assigned",
  "GIS HEAD": "assigned",
  "FIELD EXECUTIVE": "assigned",
};
const MANAGERS = { ADMIN: "all", "ZONAL MANAGER": "assigned" };
const DOERS = { ADMIN: "all", "ZONAL MANAGER": "assigned", "FIELD EXECUTIVE": "assigned" };

export const PERMISSIONS = {
  viewBlockProfile: VIEWERS,
  // A Zonal Manager who creates a block is put on its team
  createBlockProfile: { ADMIN: "all", "ZONAL MANAGER": "all" },
  // Block profiles for many blocks at once, from the LGD master
  bulkCreateBlockProfiles: { ADMIN: "all" },
  editBlockProfile: MANAGERS,
  deleteBlockProfile: MANAGERS,
  // Admin sets the Zonal Managers; a Zonal Manager sets Cluster Heads, GIS Heads and Field Executives
  manageTeam: MANAGERS,
  manageKml: MANAGERS,
  // Create, edit and delete sections
  createSection: MANAGERS,
  freezeBlock: { ADMIN: "all" },

  // OFC execution
  viewExecution: VIEWERS,
  captureInfra: DOERS,
  // Block / GP / misc equipment sheets, filled on the web portal
  manageInfraEquipment: MANAGERS,
  // Create, start, entries, end, reopen
  executeSubsection: DOERS,
  deleteSubsection: MANAGERS,
  executeRestoration: DOERS,
  // Cluster Head and GIS Head each approve or reject every ended subsection
  reviewSubsection: { "CLUSTER HEAD": "assigned", "GIS HEAD": "assigned" },
  // Zonal Manager approves a section to Admin; Admin's approval freezes it. Either can
  // reject it back, reopening the subsections they pick.
  reviewSection: MANAGERS,
  // Close a gap between nearby pits, or undo that
  mergePits: { ...MANAGERS, "GIS HEAD": "assigned" },
  approveRestoration: { ADMIN: "all" },
};

// Same normalisation the mobile app applies ("field_executive" -> "FIELD EXECUTIVE").
// Tokens issued before the rename still say EXECUTION ENGINEER.
const ALIASES = { "EXECUTION ENGINEER": "FIELD EXECUTIVE" };
export const normalizeRole = (role) => {
  const normalized = String(role || "").trim().toUpperCase().replace(/_/g, " ");
  return ALIASES[normalized] || normalized;
};

export const scopeFor = (role, action) => PERMISSIONS[action]?.[normalizeRole(role)] || null;

// { action: { allowed, scope } } for one role
export const permissionsForRole = (role) =>
  Object.fromEntries(
    Object.keys(PERMISSIONS).map((action) => {
      const scope = scopeFor(role, action);
      return [action, { allowed: Boolean(scope), scope }];
    })
  );

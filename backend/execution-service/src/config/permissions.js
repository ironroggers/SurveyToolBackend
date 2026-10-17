// Who can do what with block profiles. This is the only copy of the matrix:
// the web portal and the mobile app read it from GET /api/block-profiles/permissions,
// so moving to L1–L4 roles means changing the role keys here.
//
// Not enforced on the server yet. Auth is still off for every execution-service
// route; once it lands, routes check these same actions against req.user.

export const ROLES = ["ADMIN", "SUPERVISOR", "EXECUTION ENGINEER", "SURVEYOR", "VIEWER"];

// action -> role -> scope. A role missing from an action is not allowed.
//   all:      every record
//   own:      only records the user created (createdBy)
//   assigned: only blocks assigned to the user. Block profiles have no assignment
//             data yet, so this currently covers every record.
export const PERMISSIONS = {
  viewBlockProfile: {
    ADMIN: "all",
    SUPERVISOR: "all",
    "EXECUTION ENGINEER": "assigned",
    VIEWER: "all",
  },
  createBlockProfile: {
    ADMIN: "all",
    SUPERVISOR: "all",
    "EXECUTION ENGINEER": "all",
  },
  editBlockProfile: {
    ADMIN: "all",
    SUPERVISOR: "all",
    "EXECUTION ENGINEER": "own",
  },
  deleteBlockProfile: {
    ADMIN: "all",
  },
  manageKml: {
    ADMIN: "all",
    SUPERVISOR: "all",
  },
  createSection: {
    ADMIN: "all",
    SUPERVISOR: "all",
    "EXECUTION ENGINEER": "all",
  },
};

// Same normalisation the mobile app applies ("execution_engineer" -> "EXECUTION ENGINEER")
export const normalizeRole = (role) => String(role || "").trim().toUpperCase().replace(/_/g, " ");

// { action: { allowed, scope } } for one role
export const permissionsForRole = (role) => {
  const normalized = normalizeRole(role);
  return Object.fromEntries(
    Object.entries(PERMISSIONS).map(([action, scopes]) => {
      const scope = scopes[normalized] || null;
      return [action, { allowed: Boolean(scope), scope }];
    })
  );
};

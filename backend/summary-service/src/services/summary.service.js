import Summary, { SummaryLower } from "../models/summaryModel.js";

const SHEET_NAMES = {
  GP_OPERATIONAL: "GP Operational Data",
  DEPLOYED_TEAMS: "Deployed Teams",
  DESKTOP_SURVEYS: "Desktop Surveys",
  HDD_MACHINES: "HDD Machines",
  BLOCK_ROUTERS: "Block Routers",
};

const YES_VALUES = new Set(["yes", "y", "true", "1"]);
const NO_VALUES = new Set(["no", "n", "false", "0"]);
const DEFAULT_HOTO_DATE = new Date("2025-07-31").toISOString().split("T")[0];

async function fetchSheetRows(sheetName) {
  const [primaryResult, fallbackResult] = await Promise.allSettled([
    Summary.find({ sheetName }).select("rowData").lean(),
    SummaryLower.find({ sheetName }).select("rowData").lean(),
  ]);

  const primaryRows =
    primaryResult.status === "fulfilled" ? primaryResult.value : [];
  if (primaryRows.length > 0) {
    return primaryRows.map((doc) => doc?.rowData || {});
  }

  const fallbackRows =
    fallbackResult.status === "fulfilled" ? fallbackResult.value : [];
  return fallbackRows.map((doc) => doc?.rowData || {});
}

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  return String(value).trim();
}

function normalizeYesNo(value) {
  const str = safeString(value);
  if (!str) {
    return "";
  }
  const lower = str.toLowerCase();
  if (YES_VALUES.has(lower)) {
    return "Yes";
  }
  if (NO_VALUES.has(lower)) {
    return "No";
  }
  return str;
}

function normalizeDate(value, fallback = DEFAULT_HOTO_DATE) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString().split("T")[0];
}

function mapGpsOperationalRow(row = {}) {
  return {
    District_Name: safeString(row["DISTRICT"]),
    Block_Name: safeString(row["BLOCK"]),
    Block_Code: safeString(row["Block Code"]),
    lgd_code:
      safeString(row["LOCATION CODE"]) ||
      safeString(row["LGD Code"]) ||
      safeString(row["LGD CODE"]),
    gp_name: safeString(row["ONT LOCATION NAME"]),
    ONT_Availability: safeString(row["ONT AVAILABILITY(%)"]),
    Hoto_Status: safeString(row["HOTO Status"]),
    Hoto_Date: normalizeDate(row["HOTO Date"]),
    GP_Router_Installed: normalizeYesNo(
      row["GP Router Installed(Yes/No)"] ||
      row['"GP Router Installed(Yes/No)"']
    ),
    Visibility_in_SNOC: normalizeYesNo(
      row["Visibility in SNOC(Yes/ No)"] ||
      row['"Visibility in SNOC(Yes/ No)"']
    ),
  };
}

function mapDeployedTeamRow(row = {}) {
  return {
    project: safeString(row["PROJECT"]),
    payroll: safeString(row["PAY ROLL"]),
    emp_code: safeString(row["EMP. CODE"]),
    name: safeString(row["NAME OF EMPLOYEE"]),
    designation: safeString(row["Designation"]),
    role: safeString(row["Role"]),
    head: safeString(row["HEAD"]),
  };
}

function mapDesktopSurveyRow(row = {}) {
  return {
    District_Name: safeString(row["District name"]),
    Block_Name: safeString(row["BLOCK NAME"]),
    Block_Code: safeString(row["Block LGD Code"]),
    Lgd_Code:
      safeString(row["LGD CODE"]) ||
      safeString(row["LGD Code"]) ||
      safeString(row["LGD code"]),
    Gp_Name:
      safeString(row["GP Name"]) ||
      safeString(row["GP NAME"]) ||
      safeString(row["GP Name as per Desktop Survey"]),
    Submitted: normalizeYesNo(
      row["KML Submitted to BSNL through mail (Yes/No)"]
    ),
    Approved: normalizeYesNo(row["BSNL KML Acceptance"]),
    Physical_Survey_Status: normalizeYesNo(row["Physical survey status"]),
    Physical_Survey_Approved: normalizeYesNo(
      row["Physical Survey Approved (Yes/No)"]
    ),
    Boq_Submitted: normalizeYesNo(row["BOQ Submitted"]),
    Boq_Approved: normalizeYesNo(row["BOQ Approved"]),
  };
}

function mapHddMachineRow(row = {}) {
  return {
    deployment_date: safeString(row["Deployment Date"]),
    hdd_machine_id: safeString(row["HDD NO"]),
    operator_name: safeString(row["Under Supervision & Number"]),
  };
}

function mapBlockRouterRow(row = {}) {
  return {
    District_Name: safeString(row["District"]),
    Block_Name: safeString(row["Block"]),
    Block_Code: safeString(row["Block Code"]),
    Block_Router_Installed: normalizeYesNo(
      row["Block Router Installed (Yes/No)"] ||
      row['"Block Router Installed (Yes/No)"']
    ),
  };
}

export async function getSummary() {
  const [
    gpsOperationalRows,
    deployedTeamRows,
    desktopSurveyRows,
    hddMachineRows,
    blockRouterRows,
  ] = await Promise.all([
    fetchSheetRows(SHEET_NAMES.GP_OPERATIONAL),
    fetchSheetRows(SHEET_NAMES.DEPLOYED_TEAMS),
    fetchSheetRows(SHEET_NAMES.DESKTOP_SURVEYS),
    fetchSheetRows(SHEET_NAMES.HDD_MACHINES),
    fetchSheetRows(SHEET_NAMES.BLOCK_ROUTERS),
  ]);

  const gpsOperationalData = gpsOperationalRows.map(mapGpsOperationalRow);
  const deployedTeams = deployedTeamRows.map(mapDeployedTeamRow);
  const desktopSurveys = desktopSurveyRows.map(mapDesktopSurveyRow);
  const hddMachines = hddMachineRows.map(mapHddMachineRow);
  const blockRouters = blockRouterRows.map(mapBlockRouterRow);

  const frtTeams = deployedTeams.filter((team) => team.head === "FRT");
  const patrollers = deployedTeams.filter((team) => team.head === "Patroller");

  const response = {
    Status: "success",
    Version: "1.0",
    GeneratedAt: new Date().toISOString(),
    Params: { Limit: 0, Offset: 0 },
    Summary: {
      State: "Kerala",
      Gps: {
        Operational: gpsOperationalData.filter(
          (data) => data.ONT_Availability > 0
        ).length,
        ">= 98%": gpsOperationalData.filter(
          (data) => data.ONT_Availability >= 98
        ).length,
      },
      Deployed_Teams: {
        Frt_Teams: frtTeams.length,
        Patrollers: patrollers.length,
      },
      Hoto: {
        Total_Gps: gpsOperationalData.length,
        Completed: gpsOperationalData.filter(
          (data) => data.Hoto_Status === "Completed"
        ).length,
      },
      Desktop_Survey: {
        Submitted: [
          ...new Set(
            desktopSurveys
              .filter((survey) => survey.Submitted === "Yes")
              .map((survey) => survey.Block_Code)
          ),
        ].length,
        Approved: [
          ...new Set(
            desktopSurveys
              .filter((survey) => survey.Approved === "Yes")
              .map((survey) => survey.Block_Code)
          ),
        ].length,
      },
      Physical_Survey: {
        Submitted: desktopSurveys.filter(
          (survey) => survey.Physical_Survey_Status === "Yes"
        ).length,
        Approved: desktopSurveys.filter(
          (survey) => survey.Physical_Survey_Approved === "Yes"
        ).length,
      },
      Row: { Applied: 0, Approved: 0 },
      Boq: {
        Submitted: desktopSurveys.filter(
          (survey) => survey.Boq_Submitted === "Yes"
        ).length,
        Approved: desktopSurveys.filter(
          (survey) => survey.Boq_Approved === "Yes"
        ).length,
      },
      Hdd: { Deployed: hddMachines.length },
      Block_Routers: {
        Installed: blockRouters.filter(
          (router) => router.Block_Router_Installed === "Yes"
        ).length,
        Commissioned: blockRouters.filter(
          (router) => router.Block_Router_Installed === "Yes"
        ).length, // Assuming commissioned = installed for now
      },
      Gp_Routers: {
        Installed: gpsOperationalData.filter(
          (data) => data.GP_Router_Installed === "Yes"
        ).length,
        Commissioned: gpsOperationalData.filter(
          (data) => data.GP_Router_Installed === "Yes"
        ).length, // Assuming commissioned = installed for now
      },
      Snoc: {
        Deployed: gpsOperationalData.filter(
          (data) => data.Visibility_in_SNOC === "Yes"
        ).length,
      },
      Invoice: { Submitted: 0, Approved: 0 },
    },
    Data: {
      Gps: {
        Operational: gpsOperationalData.filter(
          (data) => data.ONT_Availability > 0
        ).length,
        List: gpsOperationalData.filter((data) => data.ONT_Availability > 0),
      },
      Deployed_Teams: {
        Frt_Teams: { Count: frtTeams.length, List: frtTeams },
        Patrollers: { Count: patrollers.length, List: patrollers },
      },
      Hoto: {
        Total_Gps: gpsOperationalData.length,
        Completed_Gps_Count: gpsOperationalData.filter(
          (data) => data.Hoto_Status === "Completed"
        ).length,
        Completed_Gps_List: gpsOperationalData.filter(
          (data) => data.Hoto_Status === "Completed"
        ),
      },
      Desktop_Survey: {
        Submitted: {
          Count: [
            ...new Set(
              desktopSurveys
                .filter((survey) => survey.Submitted === "Yes")
                .map((survey) => survey.Block_Code)
            ),
          ].length,
          List: [
            ...new Map(
              desktopSurveys
                .filter((survey) => survey.Submitted === "Yes")
                .map((survey) => [survey.Block_Code, survey])
            ).values(),
          ],
        },
        Approved: {
          Count: [
            ...new Set(
              desktopSurveys
                .filter((survey) => survey.Approved === "Yes")
                .map((survey) => survey.Block_Code)
            ),
          ].length,
          List: [
            ...new Map(
              desktopSurveys
                .filter((survey) => survey.Approved === "Yes")
                .map((survey) => [survey.Block_Code, survey])
            ).values(),
          ],
        },
      },
      Physical_Survey: {
        Submitted: {
          Count: desktopSurveys.filter(
            (survey) => survey.Physical_Survey_Status === "Yes"
          ).length,
          List: desktopSurveys.filter(
            (survey) => survey.Physical_Survey_Status === "Yes"
          ),
        },
        Approved: {
          Count: desktopSurveys.filter(
            (survey) => survey.Physical_Survey_Approved === "Yes"
          ).length,
          List: desktopSurveys.filter(
            (survey) => survey.Physical_Survey_Approved === "Yes"
          ),
        },
      },
      Row: {
        Applied: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
      Boq: {
        Submitted: {
          Count: 1,
          List: [],
        },
        Approved: {
          Count: 1,
          List: [],
        },
      },
      Hdd: { Deployed: { Count: hddMachines.length, List: hddMachines } },
      Block_Routers: {
        Deployed: {
          Count: blockRouters.filter(
            (router) => router.Block_Router_Installed === "Yes"
          ).length,
          List: blockRouters.filter(
            (router) => router.Block_Router_Installed === "Yes"
          ),
        },
      },
      Gp_Routers: {
        Deployed: {
          Count: gpsOperationalData.filter(
            (data) => data.GP_Router_Installed === "Yes"
          ).length,
          List: gpsOperationalData.filter(
            (data) => data.GP_Router_Installed === "Yes"
          ),
        },
      },
      Snoc: {
        Visible: {
          Gps_Count: gpsOperationalData.filter(
            (data) => data.Visibility_in_SNOC === "Yes"
          ).length,
          Gps_List: gpsOperationalData.filter(
            (data) => data.Visibility_in_SNOC === "Yes"
          ),
        },
      },
      Invoice: {
        Submitted: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
    },
  };

  return response;
}

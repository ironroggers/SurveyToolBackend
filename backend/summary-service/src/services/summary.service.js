import { getGpsOperationalData } from "./gpsOperationalData.util.js";
import { getDeployedTeams } from "./deployedTeams.util.js";
import { getDesktopSurveys } from "./desktopSurveys.util.js";
import { getHddMachines } from "./hddMachines.util.js";
import { getBlockRouters } from "./blockRouters.util.js";

export async function getSummary() {
  const gpsOperationalData = getGpsOperationalData();
  const deployedTeams = getDeployedTeams();
  const frtTeams = deployedTeams.filter((team) => team.head === "FRT");
  const patrollers = deployedTeams.filter((team) => team.head === "Patroller");
  const desktopSurveys = getDesktopSurveys();
  const hddMachines = getHddMachines();
  const blockRouters = getBlockRouters();

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
        Submitted: desktopSurveys.filter((survey) => survey.Submitted === "Yes")
          .length,
        Approved: desktopSurveys.filter((survey) => survey.Approved === "Yes")
          .length,
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
      Block_Routers: { Deployed: blockRouters.length },
      Gp_Routers: {
        Deployed: gpsOperationalData.filter(
          (data) => data.GP_Router_Installed === "Yes"
        ).length,
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
          Count: desktopSurveys.filter((survey) => survey.Submitted === "Yes")
            .length,
          List: desktopSurveys.filter((survey) => survey.Submitted === "Yes"),
        },
        Approved: {
          Count: desktopSurveys.filter((survey) => survey.Approved === "Yes")
            .length,
          List: desktopSurveys.filter((survey) => survey.Approved === "Yes"),
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
          Count: desktopSurveys.filter(
            (survey) => survey.Boq_Submitted === "Yes"
          ).length,
          List: desktopSurveys.filter(
            (survey) => survey.Boq_Submitted === "Yes"
          ),
        },
        Approved: {
          Count: desktopSurveys.filter(
            (survey) => survey.Boq_Approved === "Yes"
          ).length,
          List: desktopSurveys.filter(
            (survey) => survey.Boq_Approved === "Yes"
          ),
        },
      },
      Hdd: { Deployed: { Count: hddMachines.length, List: hddMachines } },
      Block_Routers: {
        Deployed: { Count: blockRouters.length, List: blockRouters },
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

export async function getSummary() {
  const response = {
    Status: "success",
    Version: "1.0",
    GeneratedAt: new Date().toISOString(),
    Params: { Limit: 0, Offset: 0 },
    Summary: {
      State: "Kerala",
      Gps: { Operational: 1107, ">= 98%": 879 },
      Deployed_Teams: { Frt_Teams: 135, Patrollers: 109 },
      Hoto: { Total_Gps: 1129, Completed: 1129 },
      Desktop_Survey: { Submitted: 152, Approved: 129 },
      Physical_Survey: { Submitted: 9, Approved: 0 },
      Row: { Applied: 0, Approved: 0 },
      Boq: { Submitted: 9, Approved: 0 },
      Hdd: { Deployed: 15 },
      Block_Routers: { Deployed: 0 },
      Gp_Routers: { Deployed: 0 },
      Snoc: { Deployed: 0 },
      Invoice: { Submitted: 0, Approved: 0 },
    },
    Data: {
      Gps: { Operational: 0, List: [] },
      Deployed_Teams: {
        Frt_Teams: { Count: 0, List: [] },
        Patrollers: { Count: 0, List: [] },
      },
      Hoto: { Total_Gps: 0, Completed_Gps_Count: 0, Completed_Gps_List: [] },
      Desktop_Survey: {
        Submitted: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
      Physical_Survey: {
        Submitted: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
      Row: {
        Applied: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
      Boq: {
        Submitted: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
      Hdd: { Deployed: { Count: 0, List: [] } },
      Block_Routers: { Deployed: { Count: 0, List: [] } },
      Gp_Routers: { Deployed: { Count: 0, List: [] } },
      Snoc: { Visible: { Gps_Count: 0, Gps_List: [] } },
      Invoice: {
        Submitted: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
    },
  };

  return response;
}

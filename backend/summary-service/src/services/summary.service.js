import {
  Attendance,
  User,
  Section,
  SubSection,
  Trenching,
  Hoto,
  HotoLocation,
  Location,
  Notification,
  Route,
  Survey,
} from "../models/index.js";

async function fetchLatest(model) {
  try {
    const doc = await model.findOne({}).sort({ createdAt: -1, _id: -1 }).lean();
    if (doc) {
      // eslint-disable-next-line no-console
      console.log(`[summary-service] Sample from ${model.modelName}:`, doc);
    }
    return doc || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[summary-service] Failed fetching from ${model.modelName}:`,
      err
    );
    return null;
  }
}

async function fetchAll(model) {
  try {
    const docs = await model.find({}).lean();
    // eslint-disable-next-line no-console
    console.log(
      `[summary-service] Found ${docs.length} documents in ${model.modelName}`
    );
    return docs;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[summary-service] Failed fetching all from ${model.modelName}:`,
      err
    );
    return [];
  }
}

async function getDesktopSurveys() {
  let desktopSurveys = await Location.find({});
  desktopSurveys = desktopSurveys.map((survey) => {
    const data = {
      District_Name: survey.district,
      Block_Name: survey.block,
      Block_Code: survey.block_code,
      Lgd_Code: survey.district_code,
      Gp_Names: survey.route
        .filter((route) => route.type === "GP")
        .map((route) => route.place),
      status: survey.status,
    };

    return data;
  });

  let formattedDesktopSurveys = [];
  desktopSurveys.forEach((survey) => {
    survey.Gp_Names.forEach((gp) => {
      formattedDesktopSurveys.push({
        District_Name: survey.District_Name,
        Block_Name: survey.Block_Name,
        Block_Code: survey.Block_Code,
        Lgd_Code: survey?.Lgd_Code || null,
        Gp_Name: gp,
        status: survey.status,
      });
    });
  });

  const submittedDesktopSurveys = formattedDesktopSurveys.filter(
    (survey) => survey.status === 4
  );
  const approvedDesktopSurveys = formattedDesktopSurveys.filter(
    (survey) => survey.status === 5
  );

  return [submittedDesktopSurveys, approvedDesktopSurveys];
}

async function getPhysicalSurveys() {
  const physicalSurveys = await Survey.find({});
  const submittedPhysicalSurveys = physicalSurveys.filter(
    (survey) => survey.status === 4
  );
  const approvedPhysicalSurveys = physicalSurveys.filter(
    (survey) => survey.status === 5
  );

  return [submittedPhysicalSurveys, approvedPhysicalSurveys];
}

export async function getSummary() {
  const patrollers = await User.find({
    project: "BharatNet Kerala",
    role: "SURVEYOR",
  })
    .select("username email designation")
    .lean();

  const [submittedDesktopSurveys, approvedDesktopSurveys] =
    await getDesktopSurveys();
  const [submittedPhysicalSurveys, approvedPhysicalSurveys] =
    await getPhysicalSurveys();

  const response = {
    Status: "success",
    Version: "1.0",
    GeneratedAt: new Date().toISOString(),
    Params: { Limit: 0, Offset: 0 },
    Summary: {
      State: "Kerala",
      Gps: { Operational: null },
      Deployed_Teams: { Frt_Teams: 0, Patrollers: patrollers.length },
      Hoto: { Total_Gps: 0, Completed: 0 },
      Desktop_Survey: {
        Submitted: submittedDesktopSurveys.length,
        Approved: approvedDesktopSurveys.length,
      },
      Physical_Survey: {
        Submitted: submittedPhysicalSurveys.length,
        Approved: approvedPhysicalSurveys.length,
      },
      Row: { Applied: 0, Approved: 0 },
      Boq: { Submitted: 0, Approved: 0 },
      Hdd: { Deployed: null },
      Block_Routers: { Deployed: 0 },
      Gp_Routers: { Deployed: 0 },
      Snoc: { Deployed: null },
      Invoice: { Submitted: null, Approved: null },
    },
    Data: {
      Gps: { Operational: null, List: null },
      Deployed_Teams: {
        Frt_Teams: { Count: 0, List: null },
        Patrollers: { Count: patrollers.length, List: patrollers },
      },
      Hoto: {
        Total_Gps: 0,
        Completed_Gps_Count: 0,
        Completed_Gps_List: [],
      },
      Desktop_Survey: {
        Submitted: {
          Count: submittedDesktopSurveys.length,
          List: submittedDesktopSurveys,
        },
        Approved: {
          Count: approvedDesktopSurveys.length,
          List: approvedDesktopSurveys,
        },
      },
      Physical_Survey: {
        Submitted: {
          Count: submittedPhysicalSurveys.length,
          List: submittedPhysicalSurveys,
        },
        Approved: {
          Count: approvedPhysicalSurveys.length,
          List: approvedPhysicalSurveys,
        },
      },
      Row: {
        Applied: { Count: 0, List: [] },
        Approved: { Count: 0, List: [] },
      },
      Boq: {
        Submitted: {
          Count: 0,
          List: [],
        },
        Approved: {
          Count: 0,
          List: [],
        },
      },
      Hdd: { Deployed: { Count: null, List: null } },
      Block_Routers: {
        Deployed: {
          Count: 0,
          List: [],
        },
      },
      Gp_Routers: {
        Deployed: {
          Count: 0,
          List: [],
        },
      },
      Snoc: { Visible: { Gps_Count: null, Gps_List: null } },
      Invoice: {
        Submitted: { Count: null, List: null },
        Approved: { Count: null, List: null },
      },
    },
  };

  return response;
}

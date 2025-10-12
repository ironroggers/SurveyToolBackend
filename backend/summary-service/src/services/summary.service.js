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

export async function getSummary() {
  const results = await Promise.all([
    fetchAll(Attendance),
    fetchAll(User),
    fetchAll(Section),
    fetchAll(SubSection),
    fetchAll(Trenching),
    fetchAll(Hoto),
    fetchAll(HotoLocation),
    fetchAll(Location),
    fetchAll(Notification),
    fetchAll(Route),
    fetchAll(Survey),
  ]);

  const [
    attendance,
    user,
    section,
    subSection,
    trenching,
    hoto,
    hotoLocation,
    location,
    notification,
    route,
    survey,
  ] = results;

  console.log(JSON.stringify(results, null, 2));

  return {
    attendance,
    user,
    section,
    subSection,
    trenching,
    hoto,
    hotoLocation,
    location,
    notification,
    route,
    survey,
  };
}

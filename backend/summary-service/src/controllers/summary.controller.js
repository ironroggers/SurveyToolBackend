import { getSummary } from "../services/summary.service.js";

export async function getSummaryController(req, res, next) {
  try {
    const data = await getSummary();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

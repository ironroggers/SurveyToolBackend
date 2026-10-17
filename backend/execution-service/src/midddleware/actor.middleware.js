import mongoose from "mongoose";
import { normalizeRole } from "../config/permissions.js";

// Auth is off on every execution-service route for now, so the clients say who is
// acting (X-User-Id / X-User-Name / X-User-Role) and from where (X-Client). These are
// used for history and records only, never trusted for permissions. When auth lands,
// fill req.actor from the verified token instead.
const header = (req, name) => {
  const value = req.get(name);
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

export const readActor = (req, res, next) => {
  const id = header(req, "X-User-Id");
  req.actor = {
    id: mongoose.isValidObjectId(id) ? id : undefined,
    name: header(req, "X-User-Name") || undefined,
    role: normalizeRole(header(req, "X-User-Role")) || undefined,
  };
  const client = header(req, "X-Client").toLowerCase();
  req.client = client === "mobile" || client === "web" ? client : undefined;
  next();
};

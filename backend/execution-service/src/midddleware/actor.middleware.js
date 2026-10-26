import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { normalizeRole } from "../config/permissions.js";

// Every execution-service route needs the auth-service login token (Authorization:
// Bearer …, signed with the shared JWT_SECRET). Who is acting comes from the token:
// { id, role }. The X-User-Name header only gives the name shown in history, and
// X-Client says where from (mobile / web).
const header = (req, name) => {
  const value = req.get(name);
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

export const requireAuth = (req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[auth] JWT_SECRET is not set; refusing every request");
    return res.status(500).json({ message: "Sign-in isn't configured on the execution service" });
  }
  const token = req.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Please sign in", code: "UNAUTHENTICATED" });

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again", code: "UNAUTHENTICATED" });
  }
  const id = String(decoded.id || decoded._id || "");
  req.actor = {
    id: mongoose.isValidObjectId(id) ? id : undefined,
    name: header(req, "X-User-Name") || undefined,
    role: normalizeRole(decoded.role) || undefined,
  };
  const client = header(req, "X-Client").toLowerCase();
  req.client = client === "mobile" || client === "web" ? client : undefined;
  next();
};

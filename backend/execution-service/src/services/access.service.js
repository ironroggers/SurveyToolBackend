import mongoose from "mongoose";
import BlockProfile from "../models/blockProfile.model.js";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import { normalizeRole, scopeFor } from "../config/permissions.js";
import { HttpError, notFound, sendError } from "../utils/httpError.js";

// Who may see and change what, from the signed-in user (req.actor, set by requireAuth)
// and the matrix in config/permissions.js:
//   - an action's scope is "all" or "assigned" (only blocks whose team the user is on, in their role)
//   - the demo block is ADMIN only
//   - a frozen block or section is read-only for everyone but ADMIN

export const actorRole = (req) => normalizeRole(req.actor?.role);
export const isAdmin = (req) => actorRole(req) === "ADMIN";

export const forbidden = (message) => new HttpError(403, message, { code: "FORBIDDEN" });
const frozenError = (message) => new HttpError(409, message, { code: "FROZEN" });

// The action's scope for this user, or a 403
export const assertAllowed = (req, action) => {
  const scope = scopeFor(req.actor?.role, action);
  if (!scope) throw forbidden("You don't have access to do this");
  return scope;
};

export const can = (req, action) => Boolean(scopeFor(req.actor?.role, action));

// On the block's team in their own role (a user whose role changed loses the old assignments)
export const onTeam = (profile, req) =>
  Boolean(req.actor?.id) && (profile?.team || []).some((m) => String(m.userId) === String(req.actor.id) && m.role === actorRole(req));

// Mongo filter for the BlockProfile queries a user may see
export const blockFilter = (req, action = "viewBlockProfile") => {
  const scope = assertAllowed(req, action);
  const filter = isAdmin(req) ? {} : { isDemo: { $ne: true } };
  if (scope === "assigned") {
    filter.team = { $elemMatch: { userId: new mongoose.Types.ObjectId(String(req.actor?.id || "000000000000000000000000")), role: actorRole(req) } };
  }
  return filter;
};

// Ids of the blocks a user may see, or null when they see every block (ADMIN)
export const visibleBlockIds = async (req, action = "viewExecution") => {
  const filter = blockFilter(req, action);
  if (!Object.keys(filter).length) return null;
  return BlockProfile.find(filter).distinct("_id");
};

// Filter for Section queries: block sections of visible blocks (older location sections stay visible)
export const sectionFilter = async (req, action = "viewExecution") => {
  const ids = await visibleBlockIds(req, action);
  if (!ids) return {};
  return { $or: [{ blockProfile: { $exists: false } }, { blockProfile: null }, { blockProfile: { $in: ids } }] };
};

// Ids of visible block sections, or null for all (for SubSection / Restoration queries)
export const visibleSectionIds = async (req, action = "viewExecution") => {
  const ids = await visibleBlockIds(req, action);
  if (!ids) return null;
  return Section.find({ blockProfile: { $in: ids } }).distinct("_id");
};

export const assertBlockAccess = (req, action, profile) => {
  const scope = assertAllowed(req, action);
  if (profile.isDemo && !isAdmin(req)) throw notFound("Block profile not found");
  if (scope === "assigned" && !onTeam(profile, req)) throw forbidden("You're not on this block's team");
};

export const sectionStage = (section) => section?.review?.stage || "FIELD";

// Frozen data is read-only for everyone but ADMIN
export const assertWritable = (req, profile, section) => {
  if (isAdmin(req)) return;
  if (profile?.frozen?.at) throw frozenError("This block is frozen. Only Admin can change it");
  if (section && sectionStage(section) === "FROZEN") throw frozenError("This section is frozen. Only Admin can change it");
};

// ---- loaders

const loadProfile = async (id) => {
  const profile = mongoose.isValidObjectId(id) ? await BlockProfile.findById(id) : null;
  if (!profile) throw notFound("Block profile not found");
  return profile;
};

const loadSection = async (id) => {
  const section = mongoose.isValidObjectId(id) ? await Section.findById(id) : null;
  if (!section) throw notFound("Section not found");
  return section;
};

const loadSubsection = async (id) => {
  const sub = mongoose.isValidObjectId(id) ? await SubSection.findById(id).select("section typeOfWork") : null;
  if (!sub) throw notFound("Subsection not found");
  return sub;
};

// Checks access to a section's block. Sections without a block profile (the older
// location sections) need only a signed-in user.
export const checkSection = async (req, action, section, { write = false } = {}) => {
  if (!section.blockProfile) return null;
  const profile = await loadProfile(section.blockProfile);
  assertBlockAccess(req, action, profile);
  if (write) assertWritable(req, profile, section);
  return profile;
};

// ---- route guards. Each loads what it checks onto req.access = { profile, section }

const wrap = (check) => async (req, res, next) => {
  try {
    req.access = await check(req);
    next();
  } catch (error) {
    sendError(res, error);
  }
};

// The action needs to be allowed for the user's role (lists filter by scope themselves)
export const requireAction = (action) =>
  wrap(async (req) => {
    assertAllowed(req, action);
    return {};
  });

// A block profile route (/:id or another param)
export const guardBlock = (action, { write = false, param = "id" } = {}) =>
  wrap(async (req) => {
    const profile = await loadProfile(req.params[param]);
    assertBlockAccess(req, action, profile);
    if (write) assertWritable(req, profile);
    return { profile };
  });

// A section route; the id comes from the URL by default, or from the body / query
export const guardSection = (action, { write = false, from = "params", key = "id" } = {}) =>
  wrap(async (req) => {
    const id = from === "params" ? req.params[key] : from === "body" ? req.body?.[key] : req.query?.[key];
    const section = await loadSection(id);
    const profile = await checkSection(req, action, section, { write });
    return { profile, section };
  });

// A subsection route (/:id); older subsections outside block sections need only a signed-in user
export const guardSubsection = (action, { write = false, param = "id" } = {}) =>
  wrap(async (req) => {
    const sub = await loadSubsection(req.params[param]);
    const section = await Section.findById(sub.section);
    if (!section) return { sub };
    const profile = await checkSection(req, action, section, { write });
    return { profile, section, sub };
  });

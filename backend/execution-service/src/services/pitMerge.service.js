import mongoose from "mongoose";
import { EXECUTION_TYPES, executionLimits } from "../config/executionTypes.js";
import Section from "../models/section.model.js";
import SubSection from "../models/subSection.model.js";
import { distanceM, formatLatLong, round } from "../utils/geo.js";
import { badRequest, conflict, notFound } from "../utils/httpError.js";
import { assertWritable } from "./access.service.js";
import { actorOf, historyEntry } from "./execution.service.js";

// Back-to-back subsections whose pits should be one point but were captured separately leave
// small gaps on the map. A GIS Head, Zonal Manager or Admin picks one pit; the others take its
// location. Each pit keeps its own reference points, photos and video, and pit.merge holds its
// original location and the other pits' data, so nothing is lost and a merge can be undone.
// Tape distances stay as measured, to the original pit.

const SIDES = ["start", "end"];
// Pits copied with the suggestion are the same point, not a gap
const SAME_SPOT_M = 0.01;

const plain = (value) => (value?.toObject ? value.toObject() : value);
const pitOf = ({ sub, side }) => sub[side].pit;
const place = (member) => ({ lat: pitOf(member).latitude, lng: pitOf(member).longitude });
const distanceOf = (a, b) => distanceM(place(a), place(b));
const sameMember = (a, b) => a.side === b.side && String(a.sub._id) === String(b.sub._id);
const mergeIdOf = (member) => (pitOf(member).merge?.id ? String(pitOf(member).merge.id) : null);
const pitLabelOf = ({ sub, side }) => EXECUTION_TYPES[sub.typeOfWork]?.[side === "start" ? "pitA" : "pitB"] || "Pit";
const nameOf = (member) => `${member.sub.name} ${pitLabelOf(member).toLowerCase()}`;

const membersOf = (subs) =>
  subs.flatMap((sub) => SIDES.filter((side) => sub[side]?.pit?.latitude != null).map((side) => ({ sub, side })));

const blockSubs = async (profile) => {
  const sections = await Section.find({ blockProfile: profile._id }).select("name review blockProfile");
  const subs = await SubSection.find({
    section: { $in: sections.map((s) => s._id) },
    $or: [{ "start.pit.latitude": { $exists: true } }, { "end.pit.latitude": { $exists: true } }],
  });
  return { sections, subs };
};

// What the merge dialog shows of one pit
const pitCard = (member, sectionName) => {
  const { sub, side } = member;
  const pit = plain(pitOf(member));
  return {
    subSection: sub._id,
    name: sub.name,
    side,
    pitLabel: pitLabelOf(member),
    sectionName,
    executionStatus: sub.executionStatus,
    latitude: pit.latitude,
    longitude: pit.longitude,
    accuracy: pit.accuracy,
    at: sub[side].at,
    by: sub[side].by,
    refs: pit.refs || [],
    photos: pit.photos || [],
    video: pit.video,
    mergeId: pit.merge?.id,
  };
};

/** Pits of the block close enough to merge, nearest first; subSection keeps those touching it */
export const findPitGaps = async (profile, subSection) => {
  const { pitMergeMaxGapM } = executionLimits();
  const { sections, subs } = await blockSubs(profile);
  const sectionNames = new Map(sections.map((s) => [String(s._id), s.name]));
  const members = membersOf(subs);
  const seen = new Set();
  const gaps = [];
  members.forEach((a, i) => {
    members.slice(i + 1).forEach((b) => {
      if (String(a.sub._id) === String(b.sub._id)) return;
      if (mergeIdOf(a) && mergeIdOf(a) === mergeIdOf(b)) return;
      const distance = distanceOf(a, b);
      if (distance <= SAME_SPOT_M || distance > pitMergeMaxGapM) return;
      if (subSection && ![a, b].some((m) => String(m.sub._id) === String(subSection))) return;
      // Copies of a pit stand on one spot: one gap, and they merge together
      const key = [place(a), place(b)].map((p) => `${p.lat},${p.lng}`).sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      gaps.push({
        distanceM: round(distance, 2),
        a: pitCard(a, sectionNames.get(String(a.sub.section))),
        b: pitCard(b, sectionNames.get(String(b.sub.section))),
      });
    });
  });
  return { gaps: gaps.sort((x, y) => x.distanceM - y.distanceM), maxGapM: pitMergeMaxGapM };
};

const moveTo = (member, target) => {
  const { sub, side } = member;
  ["latitude", "longitude", "accuracy", "accuracyAboveLimit"].forEach((key) => {
    sub[side].pit[key] = target[key];
    sub[side][key] = target[key];
  });
};

const isCopyOf = (a, b) => String(pitOf(a).copiedFrom || "") === String(b.sub._id);

// Every member shows the data of the others, except a pit it was copied from or to (the same data)
const fillOthers = (members) =>
  members.forEach((member) => {
    pitOf(member).merge.others = members
      .filter((other) => !sameMember(other, member) && !isCopyOf(other, member) && !isCopyOf(member, other))
      .map((other) => {
        const pit = plain(pitOf(other));
        const original = pit.merge.original;
        return {
          subSection: other.sub._id,
          name: other.sub.name,
          side: other.side,
          pitLabel: pitLabelOf(other),
          latitude: original.latitude,
          longitude: original.longitude,
          refs: pit.refs || [],
          photos: pit.photos || [],
          video: pit.video,
        };
      });
  });

const saveAll = async (members, ...extra) => {
  const docs = new Map([...members.map((m) => m.sub), ...extra].map((sub) => [String(sub._id), sub]));
  // Only what the merge changed: an old field elsewhere on a subsection mustn't stop it
  await Promise.all([...docs.values()].map((sub) => sub.validate({ validateModifiedOnly: true })));
  for (const sub of docs.values()) await sub.save({ validateModifiedOnly: true });
};

const assertAllWritable = (req, profile, members, sections) => {
  const ids = new Set(members.map((m) => String(m.sub.section)));
  sections.filter((s) => ids.has(String(s._id))).forEach((section) => assertWritable(req, profile, section));
};

/**
 * Merges the picked pits (with any they are already merged with, and copies on the same spot)
 * at the location of `keep`. Statuses and approvals stay; each subsection logs it in its history.
 */
export const mergePits = async (req, profile, pits, keep) => {
  const { sections, subs } = await blockSubs(profile);
  const all = membersOf(subs);
  const find = (ref) => all.find((m) => String(m.sub._id) === String(ref?.subSection) && m.side === ref?.side);
  const picked = (Array.isArray(pits) ? pits : []).map(find);
  if (picked.length < 2 || picked.some((m) => !m)) throw badRequest("Pick at least two recorded pits of this block");
  const kept = find(keep);
  if (!kept || !picked.some((m) => sameMember(m, kept))) throw badRequest("Pick which pit's location to keep");

  const members = [];
  const add = (member) => {
    if (!members.some((m) => sameMember(m, member))) members.push(member);
  };
  picked.forEach(add);
  picked.forEach((p) => all.filter((m) => mergeIdOf(p) && mergeIdOf(m) === mergeIdOf(p)).forEach(add));
  if (new Set(members.map((m) => String(m.sub._id))).size < members.length) {
    throw conflict("A subsection's own start and end pits can't be merged", "WRONG_STATE");
  }
  [...members].forEach((p) =>
    all
      .filter((m) => distanceOf(p, m) <= SAME_SPOT_M && !members.some((x) => String(x.sub._id) === String(m.sub._id)))
      .forEach(add)
  );

  const { pitMergeMaxGapM } = executionLimits();
  const widest = Math.max(...members.flatMap((a) => members.map((b) => distanceOf(a, b))));
  if (widest > pitMergeMaxGapM) {
    throw conflict(`These pits are ${round(widest, 1)} m apart. Only pits within ${pitMergeMaxGapM} m can be merged`, "WRONG_STATE");
  }
  assertAllWritable(req, profile, members, sections);

  const target = plain(pitOf(kept));
  const id = new mongoose.Types.ObjectId();
  const at = new Date();
  const names = (member) => members.filter((m) => !sameMember(m, member)).map(nameOf).join(", ");
  members.forEach((member) => {
    const pit = plain(pitOf(member));
    const original = pit.merge?.original || {
      latitude: pit.latitude,
      longitude: pit.longitude,
      accuracy: pit.accuracy,
      accuracyAboveLimit: pit.accuracyAboveLimit,
    };
    const moved = round(distanceM({ lat: pit.latitude, lng: pit.longitude }, { lat: target.latitude, lng: target.longitude }), 2);
    moveTo(member, target);
    pitOf(member).merge = { id, at, by: actorOf(req), keptFrom: nameOf(kept), original, others: [] };
    member.sub.history.push(
      historyEntry(
        req,
        "pit_merged",
        `${pitLabelOf(member)} merged with ${names(member)} · location of ${nameOf(kept)} kept · moved ${moved} m from ${formatLatLong({ lat: pit.latitude, lng: pit.longitude })}`
      )
    );
    member.sub.updatedBy = actorOf(req);
  });
  fillOthers(members);
  await saveAll(members);
  return { mergeId: id, members: members.length };
};

/** Puts every pit of a merge back at its original location; the reason goes in each history */
export const undoPitMerge = async (req, profile, mergeId, reason) => {
  const remark = String(reason || "").trim();
  if (!remark) throw badRequest("Say why the merge is undone", { reason: "Say why the merge is undone" });
  const { sections, subs } = await blockSubs(profile);
  const members = membersOf(subs).filter((m) => mergeIdOf(m) === String(mergeId));
  if (!members.length) throw notFound("Merge not found");
  assertAllWritable(req, profile, members, sections);
  members.forEach((member) => {
    moveTo(member, plain(pitOf(member)).merge.original);
    pitOf(member).merge = undefined;
    member.sub.history.push(historyEntry(req, "pit_merge_undone", `${pitLabelOf(member)} merge undone · back at its original location`, remark));
    member.sub.updatedBy = actorOf(req);
  });
  await saveAll(members);
  return { members: members.length };
};

/**
 * After a member's pit changed or left (recaptured on a reopened subsection, or deleted): the
 * rest keep the merged location and refresh what they show of each other. One pit alone is no
 * longer a merge. `current` is the document already in memory, if any.
 */
export const syncPitMerge = async (req, mergeId, current) => {
  const found = await SubSection.find({ $or: SIDES.map((side) => ({ [`${side}.pit.merge.id`]: mergeId })) });
  const subs = found.map((sub) => (current && String(sub._id) === String(current._id) ? current : sub));
  const members = membersOf(subs).filter((m) => mergeIdOf(m) === String(mergeId));
  if (!members.length) return;
  if (members.length === 1) {
    const [last] = members;
    pitOf(last).merge = undefined;
    last.sub.history.push(historyEntry(req, "pit_merge_ended", `${pitLabelOf(last)} is no longer merged · the other pit was recaptured or removed`));
  } else {
    fillOthers(members);
  }
  await saveAll(members);
};

import SubSection from "../models/subSection.model.js";
import { executionLimits } from "../config/executionTypes.js";
import { distanceM, fractionAlong, parseLatLong, pointOf } from "../utils/geo.js";

// Pits come from excavation: every subsection has a start pit, and an end pit once End is tapped.
// Ducting, Coupling and Blowing all work from them, so this is the one place that says what a
// pit is. A pit is stored on a record as `<subsection id>:<start|end>`, which stays valid when
// pits are merged or renumbered; its "Pit 3" name is worked out on every read.

export const PIT_SELECT = "start.pit.latitude start.pit.longitude start.pit.accuracy start.pit.merge.id end.pit.latitude end.pit.longitude end.pit.accuracy end.pit.merge.id";

const SIDES = ["start", "end"];
export const pitKey = (subId, side) => `${subId}:${side}`;
export const isPitKey = (value) => /^[0-9a-f]{24}:(start|end)$/i.test(String(value));

// Chainage: the straight line between the section's ends scaled to its length, as on the L14
// diagram. Approximate on a winding road; null without both ends.
export const chainageModel = (section) => {
  const from = parseLatLong(section.fromLatLong);
  const to = parseLatLong(section.toLatLong);
  const geo = from && to;
  const length = section.sectionLength || (geo ? distanceM(from, to) : 0);
  return { lengthM: length, at: (p) => (geo && p ? Math.round(fractionAlong(from, to, p) * length) : null) };
};

const looseOf = (subs) =>
  subs.flatMap((sub, order) =>
    SIDES.filter((side) => pointOf(sub[side]?.pit)).map((side) => ({
      key: pitKey(sub._id, side),
      subId: String(sub._id),
      order,
      point: pointOf(sub[side].pit),
      accuracy: sub[side].pit.accuracy,
      mergeId: sub[side].pit.merge?.id ? String(sub[side].pit.merge.id) : null,
    }))
  );

// Merged pits are one pit, and so are two subsections' pits within the pit suggestion limit
const samePit = (a, b, limit) => {
  if (a.mergeId && a.mergeId === b.mergeId) return true;
  return a.subId !== b.subId && distanceM(a.point, b.point) <= limit;
};

/** The section's pits, along the route: { list, byKey }. Each has every subsection pit it stands for in `keys`. */
export const sectionPits = (subs, chainage) => {
  const limit = executionLimits().pitSuggestionRadiusM;
  const groups = [];
  for (const pit of looseOf(subs)) {
    const hits = groups.filter((g) => g.some((other) => samePit(pit, other, limit)));
    const joined = [pit, ...hits.flat()];
    hits.forEach((g) => groups.splice(groups.indexOf(g), 1));
    groups.push(joined);
  }
  const list = groups
    .map((members) => {
      const first = [...members].sort((a, b) => a.order - b.order)[0];
      return {
        key: first.key,
        keys: members.map((m) => m.key),
        chainageM: chainage.at(first.point),
        order: first.order,
        latitude: first.point.lat,
        longitude: first.point.lng,
        accuracy: first.accuracy,
      };
    })
    .sort((a, b) => (a.chainageM ?? Infinity) - (b.chainageM ?? Infinity) || a.order - b.order)
    .map(({ order: _order, ...pit }, i) => ({ ...pit, name: `Pit ${i + 1}` }));
  const byKey = new Map(list.flatMap((pit) => pit.keys.map((key) => [key, pit])));
  return { list, byKey };
};

/** A coupling point: a pit where two or more duct runs meet. `couplings` are the recorded ones. */
export const findCouplingPoints = (pits, ducts, couplings = []) =>
  pits.list.flatMap((pit) => {
    const runs = ducts.filter((d) => SIDES.some((side) => pit.keys.includes(pitKey(d.links?.subSection, side))));
    if (runs.length < 2) return [];
    const record = couplings.find((c) => pit.keys.includes(c.data?.pit));
    return [{ pit, runs, record }];
  });

// Enough to check a pit on a save, in one read
export const loadSectionPits = async (section) => {
  const subs = await SubSection.find({ section: section._id, typeOfWork: { $exists: true } }).select(PIT_SELECT).sort({ seq: 1 }).lean();
  return sectionPits(subs, chainageModel(section));
};

// A block's network nodes are its block router, its GPs and its BJCs (branch joint closures). Sections under a block
// profile run from one node to another, referenced as { type, code }. A block has one
// router, so its code is the block's LGD code (blockCode).

export const NODE_TYPES = ["ROUTER", "GP", "BJC"];
export const ROUTER_NAME = "Block router";

// The router's own name when the block profile gives one, else "Block router"
export const routerName = (profile) => String(profile?.blockRouter?.name || "").trim() || ROUTER_NAME;

// The block router as a node
export const routerNode = (profile) => ({
  type: "ROUTER",
  code: profile.blockCode,
  name: routerName(profile),
  latitude: profile.blockRouter?.latitude,
  longitude: profile.blockRouter?.longitude,
});

// { type, code, name, latitude, longitude } for a reference, or null if the block doesn't have it.
// Any ROUTER reference is the block's router, so it still resolves after the block code changes.
export const findBlockNode = (profile, ref) => {
  if (ref?.type === "ROUTER") return routerNode(profile);
  const code = String(ref?.code ?? "").trim();
  if (!code) return null;
  if (ref.type === "GP") {
    const gp = (profile.gps || []).find((item) => item.lgdCode === code);
    return gp ? { type: "GP", code, name: gp.name, latitude: gp.latitude, longitude: gp.longitude } : null;
  }
  if (ref.type === "BJC") {
    const bjc = (profile.bjcs || []).find((item) => item.code === code.toUpperCase());
    return bjc ? { type: "BJC", code: bjc.code, name: bjc.name, latitude: bjc.latitude, longitude: bjc.longitude } : null;
  }
  return null;
};

// The "lat, long" text sections have always stored; empty when the node has no coordinates
export const formatLatLong = (node) =>
  node.latitude != null && node.longitude != null ? `${node.latitude}, ${node.longitude}` : "";

// A section end as a stage record stores it (a chamber at the GP or block router)
export const nodeKey = (node) => `${node.type}:${node.code}`;

/**
 * A block section's two ends: { key, type, name, latitude, longitude }, From first. The location is
 * the block profile's, else the section's own From / To; `profile` is optional.
 */
export const sectionEnds = (section, profile) =>
  [
    [section.fromNode, section.fromLatLong],
    [section.toNode, section.toLatLong],
  ]
    .filter(([node]) => node?.type && node?.code)
    .map(([node, latLong]) => {
      const found = profile ? findBlockNode(profile, node) : null;
      const [lat, lng] = String(latLong || "").split(",").map((v) => parseFloat(v));
      const has = found?.latitude != null && found?.longitude != null;
      return {
        key: nodeKey(node),
        type: node.type,
        name: found?.name || node.name || node.code,
        latitude: has ? found.latitude : Number.isFinite(lat) ? lat : undefined,
        longitude: has ? found.longitude : Number.isFinite(lng) ? lng : undefined,
      };
    });

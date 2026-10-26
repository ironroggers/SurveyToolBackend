// A block's network nodes are its block router and its GPs. Sections under a block
// profile run from one node to another, referenced as { type, code }. A block has one
// router, so its code is the block's LGD code (blockCode).

export const NODE_TYPES = ["ROUTER", "GP"];
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
  return null;
};

// The "lat, long" text sections have always stored; empty when the node has no coordinates
export const formatLatLong = (node) =>
  node.latitude != null && node.longitude != null ? `${node.latitude}, ${node.longitude}` : "";

// A block's network nodes are its BHQ and its GPs. Sections under a block
// profile run from one node to another, referenced as { type, code }.

export const NODE_TYPES = ["BHQ", "GP"];

// { type, code, name, latitude, longitude } for a reference, or null if the block doesn't have it
export const findBlockNode = (profile, ref) => {
  const code = String(ref?.code ?? "").trim();
  if (!code) return null;
  if (ref.type === "BHQ") {
    const bhq = profile.bhq;
    return bhq?.code === code
      ? { type: "BHQ", code, name: bhq.name, latitude: bhq.latitude, longitude: bhq.longitude }
      : null;
  }
  if (ref.type === "GP") {
    const gp = (profile.gps || []).find((item) => item.lgdCode === code);
    return gp ? { type: "GP", code, name: gp.name, latitude: gp.latitude, longitude: gp.longitude } : null;
  }
  return null;
};

// The "lat, long" text sections have always stored; empty when the node has no coordinates
export const formatLatLong = (node) =>
  node.latitude != null && node.longitude != null ? `${node.latitude}, ${node.longitude}` : "";

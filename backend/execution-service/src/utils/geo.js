// Distance between two { lat, lng } points in metres (haversine)
export const distanceM = (a, b) => {
  const R = 6371000;
  const k = Math.PI / 180;
  const dLat = (b.lat - a.lat) * k;
  const dLng = (b.lng - a.lng) * k;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export const isValidPoint = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// "9.9816, 76.2999" -> { lat, lng }; anything else -> null
export const parseLatLong = (value) => {
  const parts = String(value ?? "")
    .split(",")
    .map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => part === "")) return null;
  const [lat, lng] = parts.map(Number);
  return isValidPoint(lat, lng) ? { lat, lng } : null;
};

// { latitude, longitude } -> { lat, lng } or null
export const pointOf = (obj) => {
  if (!obj || obj.latitude == null || obj.longitude == null || obj.latitude === "" || obj.longitude === "") return null;
  const lat = Number(obj.latitude);
  const lng = Number(obj.longitude);
  return isValidPoint(lat, lng) ? { lat, lng } : null;
};

export const formatLatLong = ({ lat, lng }) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

export const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

// A subsection's calculated length: the straight distance between its planned From and To
// ("lat, long" strings), whole metres; null without both points
export const calculatedLengthOf = ({ fromLatLong, toLatLong }) => {
  const from = parseLatLong(fromLatLong);
  const to = parseLatLong(toLatLong);
  return from && to ? Math.round(distanceM(from, to)) : null;
};

export function distanceM(a, b) {
  if (!a || !b) return Infinity;
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  if (a.lat === "" || a.lng === "" || b.lat === "" || b.lng === "") return Infinity;
  const aLat = typeof a.lat === "number" ? a.lat : parseFloat(a.lat);
  const aLng = typeof a.lng === "number" ? a.lng : parseFloat(a.lng);
  const bLat = typeof b.lat === "number" ? b.lat : parseFloat(b.lat);
  const bLng = typeof b.lng === "number" ? b.lng : parseFloat(b.lng);
  if (!Number.isFinite(aLat) || !Number.isFinite(aLng) || !Number.isFinite(bLat) || !Number.isFinite(bLng)) {
    return Infinity;
  }
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}
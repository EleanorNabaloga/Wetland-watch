import { distanceM } from "./geo";

// Hints for the human reviewer. Nothing is ever rejected automatically.
export const FLAG_TEXT = {
  "future-time": "Photo time is in the future",
  "weak-gps": "Weak GPS signal (worse than 50 m)",
  "pin-far-from-gps": "Reporter moved the pin more than 200 m from their GPS reading",
  "from-gallery": "Photo came from the gallery, not the live camera",
  "no-photo-time": "A gallery photo has no capture time",
  "old-photo": "A photo was taken more than 48 hours before it was sent",
  "no-photo-gps": "Gallery photos carry no GPS data",
  "photo-gps-far-from-pin": "A photo's own GPS is more than 200 m from the pin",
};

// NOTE: the inputs come from the phone, so a determined person could fake them.
// Real tamper-resistance needs device attestation and signing keys (a later step).
export function computeFlags({ source, capturedAt, receivedAt, meta, gps, pin }) {
  const f = [];
  if (capturedAt > receivedAt + 5 * 60000) f.push("future-time");
  if (gps && gps.acc > 50) f.push("weak-gps");
  if (gps && distanceM(gps, pin) > 200) f.push("pin-far-from-gps");
  if (source === "upload") {
    f.push("from-gallery");
    if (meta.some((m) => !m.takenAt)) f.push("no-photo-time");
    if (meta.some((m) => m.takenAt && receivedAt - m.takenAt > 48 * 3600000)) f.push("old-photo");
    const withGps = meta.filter((m) => typeof m.lat === "number" && typeof m.lng === "number");
    if (!withGps.length) f.push("no-photo-gps");
    else if (withGps.some((m) => distanceM({ lat: m.lat, lng: m.lng }, pin) > 200)) f.push("photo-gps-far-from-pin");
  }
  return f;
}
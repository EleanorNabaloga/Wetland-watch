import { NextResponse } from "next/server";
import { addReport, forReporter, TYPES } from "@/lib/db";
import { hit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Many phones share one public IP on mobile networks, so keep this generous.
const MAX_REPORTS_PER_HOUR = 30;

const fail = (status, error) => NextResponse.json({ error }, { status });

// POST /api/reports -> anyone can send a report. No sign-in. Returns the reporter's secret token once.
export async function POST(req) {
  if (!hit("report:" + clientIp(req), MAX_REPORTS_PER_HOUR, 60 * 60 * 1000)) {
    return fail(
      429,
      "Too many reports from this connection. Please try again later.",
    );
  }
  const b = await req.json().catch(() => null);
  if (!b) return fail(400, "Invalid request");
  if (
    typeof b.photo !== "string" ||
    !b.photo.startsWith("data:image/jpeg;base64,") ||
    b.photo.length > 2_000_000
  )
    return fail(400, "A photo is required");
  const { lat, lng } = b;
  const acc = b.acc == null ? null : b.acc;
  if (![lat, lng].every((n) => typeof n === "number" && Number.isFinite(n)))
    return fail(400, "Location is required");
  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (acc !== null &&
      (typeof acc !== "number" || !Number.isFinite(acc) || acc < 0))
  )
    return fail(400, "Location is invalid");
  const type = TYPES.includes(b.type) ? b.type : "";
  const note = typeof b.note === "string" ? b.note.slice(0, 200) : "";
  const hash = typeof b.hash === "string" ? b.hash.slice(0, 64) : "";
  const ts = Number.isFinite(b.ts) ? b.ts : Date.now();
  const source = b.source === "upload" ? "upload" : "camera";
  const locationSource = b.locationSource === "photo" ? "photo" : "device";
  const timeSource = b.timeSource === "photo" ? "photo" : "submitted";
  const publicKey =
    typeof b.publicKey === "string" ? b.publicKey.slice(0, 2048) : "";
  const result = await addReport({
    photo: b.photo,
    lat,
    lng,
    acc,
    type,
    note,
    hash,
    ts,
    source,
    locationSource,
    timeSource,
    publicKey,
  });
  if (result.duplicate)
    return fail(409, "This photo has already been submitted.");
  const { report, token } = result;
  // small response: no photo sent back over the reporter's data connection
  return NextResponse.json({ ...forReporter(report), token }, { status: 201 });
}

import { NextResponse } from "next/server";
import {
  addReport,
  forReporter,
  TYPES,
  dupStore,
  recordDuplicateAttempt,
} from "@/lib/db";
import { hit, clientIp } from "@/lib/ratelimit";
import { decodeImageDataUrl } from "@/lib/dup/hash";
import { inspectPhoto, fingerprintsToStore, isRejected } from "@/lib/dup";
import { DUPLICATE_STATUS } from "@/lib/dup/thresholds";

export const dynamic = "force-dynamic";
// sharp is a native module, so this route must not run on the edge runtime.
export const runtime = "nodejs";

// Many phones share one public IP on mobile networks, so keep this generous.
const MAX_REPORTS_PER_HOUR = 30;

const fail = (status, error, extra) =>
  NextResponse.json(extra ? { error, ...extra } : { error }, { status });

/* What the reporter is told when a photo is refused. The NEMA side gets the
   precise reason from duplicate_attempts; the reporter gets a plain sentence. */
const REJECTION_MESSAGES = {
  exact_duplicate: "This photo has already been sent.",
  exact_duplicate_claimed_elsewhere:
    "This photo has already been sent for another location.",
  near_duplicate: "This photo has already been sent.",
  near_duplicate_claimed_elsewhere:
    "This photo has already been sent for another location.",
};

const rejectionMessage = (reason) =>
  REJECTION_MESSAGES[reason] || "This photo has already been sent.";

// POST /api/reports -> anyone can send a report. No sign-in. Returns the reporter's secret token once.
export async function POST(req) {
  const ip = clientIp(req);
  if (!hit("report:" + ip, MAX_REPORTS_PER_HOUR, 60 * 60 * 1000)) {
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

  // Fingerprint the bytes as received. Nothing the phone says about the photo
  // itself is trusted for this.
  const buffer = decodeImageDataUrl(b.photo);
  if (!buffer) return fail(400, "A photo is required");

  let inspection;
  try {
    inspection = await inspectPhoto({ buffer, lat, lng, ts, store: dupStore });
  } catch (error) {
    console.error("Could not fingerprint a report photo:", error);
    return fail(400, "That photo could not be read. Please take another one.");
  }

  if (isRejected(inspection)) {
    const { reason, matchId, distance } = inspection.decision;
    await recordDuplicateAttempt({
      sha: inspection.sha,
      phash: inspection.phashHex,
      matchedReportId: matchId,
      reason,
      distance,
      lat,
      lng,
      clientIp: ip,
    });
    return fail(409, rejectionMessage(reason), { reason });
  }

  const result = await addReport(
    {
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
    },
    fingerprintsToStore(inspection),
  );

  // Two uploads of the same bytes can pass the check at the same moment. The
  // unique index stops the second one here.
  if (result.duplicate) {
    await recordDuplicateAttempt({
      sha: inspection.sha,
      phash: inspection.phashHex,
      matchedReportId: null,
      reason: "exact_duplicate_race",
      distance: 0,
      lat,
      lng,
      clientIp: ip,
    });
    return fail(409, rejectionMessage("exact_duplicate"), {
      reason: "exact_duplicate",
    });
  }

  const { report, token } = result;
  const status = inspection.decision.status;
  // small response: no photo sent back over the reporter's data connection
  return NextResponse.json(
    {
      ...forReporter(report),
      token,
      ...(status === DUPLICATE_STATUS.ACCEPT ? {} : { dupStatus: status }),
    },
    { status: 201 },
  );
}

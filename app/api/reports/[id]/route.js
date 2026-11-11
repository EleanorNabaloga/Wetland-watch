import { NextResponse } from "next/server";
import { claimReward, getReport, tokenOk, forReporter, rewardAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

const fail = (status, error) => NextResponse.json({ error }, { status });

// A reporter can read only their own status using the secret token.
export async function GET(req, { params }) {
  const { id } = await params;
  const r = await getReport(id);
  if (!r) return fail(404, "Not found");
  if (tokenOk(r, req.headers.get("x-report-token")))
    return NextResponse.json(forReporter(r));
  return fail(404, "Not found");
}

// A reporter can claim a reward, once NEMA has verified the report, using the
// report's secret token.
export async function PATCH(req, { params }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (b.claim !== true) return fail(400, "Invalid request");

  const existing = await getReport(id);
  if (!existing) return fail(404, "Not found");
  if (!tokenOk(existing, b.token)) return fail(403, "Not allowed");

  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (!/^[+\d][\d\s-]{7,18}$/.test(phone))
    return fail(400, "Enter a valid phone number");
  if (!rewardAvailable(existing)) return fail(409, "Not unlocked yet");

  const report = await claimReward(id, phone);
  if (!report) return fail(404, "Not found");
  if (!rewardAvailable(report)) return fail(409, "Not unlocked yet");
  return NextResponse.json(forReporter(report));
}

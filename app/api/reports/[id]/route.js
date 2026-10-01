import { NextResponse } from "next/server";
import { claimReward, getReport, tokenOk, forReporter } from "@/lib/db";

export const dynamic = "force-dynamic";

const fail = (status, error) => NextResponse.json({ error }, { status });

// A reporter can read only their own status using the secret token.
export async function GET(req, { params }) {
  const r = await getReport(params.id);
  if (!r) return fail(404, "Not found");
  if (tokenOk(r, req.headers.get("x-report-token")))
    return NextResponse.json(forReporter(r));
  return fail(404, "Not found");
}

// A reporter can claim an unlocked reward using the report's secret token.
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (b.claim !== true) return fail(400, "Invalid request");

  const existing = await getReport(params.id);
  if (!existing) return fail(404, "Not found");
  if (!tokenOk(existing, b.token)) return fail(403, "Not allowed");

  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (!/^[+\d][\d\s-]{7,18}$/.test(phone))
    return fail(400, "Enter a valid phone number");
  if (existing.status !== "viewed") return fail(409, "Not unlocked yet");

  const report = await claimReward(params.id, phone);
  if (!report) return fail(404, "Not found");
  if (report.status !== "viewed") return fail(409, "Not unlocked yet");
  return NextResponse.json(forReporter(report));
}

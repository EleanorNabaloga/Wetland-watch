import { NextResponse } from "next/server";
import { listForReporter } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST { items: [{ id, token }] } -> status of this phone's own reports. No photos, no locations.
// POST (not GET) keeps the secret tokens out of URLs and server logs.
export async function POST(req) {
  const b = await req.json().catch(() => null);
  const items =
    b && Array.isArray(b.items)
      ? b.items.slice(0, 50).filter((i) => i && typeof i.id === "string" && typeof i.token === "string")
      : [];
  return NextResponse.json(await listForReporter(items));
}
// Rate limiting, shared by every server instance through the database.
//
// Each key gets a fixed time window: the first hit starts it, later hits count
// up, and once the window has passed the count starts again. Keys hold a hash
// of the client's IP, never the IP itself.
//
// If the database cannot be reached, a per-instance memory count is used
// instead, so a database problem never stops people reporting.
import { createHash } from "node:crypto";
import { query } from "@/lib/db";

let tableReady;
function ensureTable() {
  if (!tableReady) {
    tableReady = query(
      `CREATE TABLE IF NOT EXISTS rate_limits (
         key          text PRIMARY KEY,
         window_start timestamptz NOT NULL DEFAULT now(),
         hits         integer NOT NULL DEFAULT 1
       )`,
    ).catch((error) => {
      tableReady = undefined;
      throw error;
    });
  }
  return tableReady;
}

const keyHash = (key) => createHash("sha256").update(String(key)).digest("hex");

/** Returns true if allowed, false if `key` has used up `limit` hits within `windowMs`. */
export async function hit(key, limit, windowMs) {
  try {
    await ensureTable();
    const res = await query(
      `INSERT INTO rate_limits AS r (key) VALUES ($1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN r.window_start < now() - make_interval(secs => $2) THEN 1 ELSE r.hits + 1 END,
         window_start = CASE WHEN r.window_start < now() - make_interval(secs => $2) THEN now() ELSE r.window_start END
       RETURNING hits`,
      [keyHash(key), windowMs / 1000],
    );
    // Now and then, clear out windows that ended more than a day ago.
    if (Math.random() < 0.01) {
      query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`).catch(() => {});
    }
    return res.rows[0].hits <= limit;
  } catch (error) {
    console.error("Rate limit falling back to memory:", error.message);
    return memoryHit(key, limit, windowMs);
  }
}

/* ---------- per-instance fallback ---------- */
const buckets = new Map();

export function memoryHit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v[v.length - 1] > 3_600_000) buckets.delete(k);
  }
  return true;
}

export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "local";
}

// Tiny in-memory rate limiter. Fine for one server process; it resets when the server restarts
// and is not shared between serverless instances (use Redis or the database for the pilot).
const buckets = new Map();

// Returns true if allowed, false if `key` has used up `limit` hits within `windowMs`.
export function hit(key, limit, windowMs) {
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
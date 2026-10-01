import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { query } from "@/lib/db";

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t) => createHash("sha256").update(String(t)).digest("hex");

// Header format: "NEMA-101:token,NEMA-102:token"
export function parseTokens(req) {
  const out = {};
  for (const part of (req.headers.get("x-report-tokens") || "").split(",").slice(0, 100)) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// Returns the ids whose token is correct.
export async function verifiedIds(tokens) {
  const ids = Object.keys(tokens);
  if (!ids.length) return [];
  const res = await query(`SELECT id, token_hash FROM reports WHERE id = ANY($1)`, [ids]);
  return res.rows
    .filter((r) => {
      if (!r.token_hash) return false;
      const a = Buffer.from(r.token_hash, "hex");
      const b = Buffer.from(hashToken(tokens[r.id]), "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    })
    .map((r) => r.id);
}

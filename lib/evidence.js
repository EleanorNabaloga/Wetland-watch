// Server-side check of the evidence signature made on the reporter's phone.
//
// The phone signs JSON.stringify([photo, lat, lng, acc, ts]) with its ECDSA
// P-256 device key (lib/device.js) and sends the signature, its public key and
// a SHA-256 hash of the same string. Here we rebuild that exact string from
// what the server received and check both.
//
// Results:
//   "verified" - signature matches: the evidence is exactly what the phone signed
//   "unsigned" - no signature sent (very old browser or signing failed)
//   "invalid"  - signature or hash does not match: the evidence was changed
import { webcrypto, createHash } from "node:crypto";

const ALGO = { name: "ECDSA", namedCurve: "P-256" };
const SIGN = { name: "ECDSA", hash: { name: "SHA-256" } };

/** The exact string the phone signs. Must match lib/device.js callers. */
export function evidenceString({ photo, lat, lng, acc, ts }) {
  return JSON.stringify([photo, lat, lng, acc ?? null, ts]);
}

/** SHA-256 hex of the evidence string: the same value a phone sends as `hash`. */
export function evidenceHash(input) {
  return createHash("sha256").update(evidenceString(input)).digest("hex");
}

function fromBase64(value) {
  if (typeof value !== "string" || !value || value.length > 4096) return null;
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null;
  const buf = Buffer.from(normalized, "base64");
  return buf.length ? buf : null;
}

/**
 * @param {{photo: string, lat: number, lng: number, acc: number|null, ts: number,
 *          signature?: string|null, publicKey?: string|null, hash?: string|null}} input
 * @returns {Promise<"verified"|"unsigned"|"invalid">}
 */
export async function verifyEvidence(input) {
  const { signature, publicKey, hash } = input;
  if (!signature && !publicKey) return "unsigned";

  const sig = fromBase64(signature);
  const spki = fromBase64(publicKey);
  if (!sig || !spki) return "invalid";

  const text = evidenceString(input);

  // The phone's hash is optional (it is "unavailable" without WebCrypto), but if
  // it is present it must match.
  if (typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash)) {
    const expected = evidenceHash(input);
    if (expected !== hash) return "invalid";
  }

  try {
    const key = await webcrypto.subtle.importKey("spki", spki, ALGO, false, ["verify"]);
    const ok = await webcrypto.subtle.verify(SIGN, key, sig, new TextEncoder().encode(text));
    return ok ? "verified" : "invalid";
  } catch {
    return "invalid";
  }
}

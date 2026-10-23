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

function fromBase64(value) {
  if (typeof value !== "string" || !value || value.length > 4096) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const buf = Buffer.from(value, "base64");
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
    const expected = createHash("sha256").update(text).digest("hex");
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

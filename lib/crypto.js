import { randomBytes, createCipheriv, createHmac } from "crypto";

function key() {
  const hex = process.env.PHONE_ENCRYPTION_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(hex))
    throw new Error("PHONE_ENCRYPTION_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

function fingerprintKey() {
  const hex =
    process.env.PHONE_FINGERPRINT_KEY ||
    process.env.PHONE_ENCRYPTION_KEY ||
    "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(
      "PHONE_FINGERPRINT_KEY or PHONE_ENCRYPTION_KEY must be 64 hex characters",
    );
  }
  return Buffer.from(hex, "hex");
}

// Normalize phone number (e.g. Uganda format: +256... or 07... -> 2567...)
export function normalizePhone(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "256" + digits.slice(1);
  }
  return digits;
}

// Keyed HMAC-SHA-256 fingerprint for pattern and reward fraud detection without decrypting
export function fingerprint(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  return createHmac("sha256", fingerprintKey())
    .update(normalized, "utf8")
    .digest("hex");
}

// Output format: iv.tag.ciphertext (all base64url)
export function encrypt(text) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc]
    .map((b) => b.toString("base64url"))
    .join(".");
}

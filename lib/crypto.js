import { randomBytes, createCipheriv } from "crypto";

function key() {
  const hex = process.env.PHONE_ENCRYPTION_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(hex))
    throw new Error("PHONE_ENCRYPTION_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
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

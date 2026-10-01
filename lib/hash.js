// SHA-256 fingerprint of photo + place + time, made on the phone at send time.
// Needs HTTPS or localhost (WebCrypto). Falls back to "unavailable".
export async function sha256(text) {
  if (typeof crypto === "undefined" || !crypto.subtle) return "unavailable";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

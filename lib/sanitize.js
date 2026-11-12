// Sanitizes citizen report notes directly on the phone before transmission
// Author: MarkDanielsMCraft

export function sanitizeNote(note) {
  if (!note || typeof note !== "string") return "";
  const bounded = note.slice(0, 1000);
  return bounded
    // Formatted and unformatted Ugandan phone numbers (e.g. +256 772 123 456, 0701-987-654, 0772123456)
    .replace(/(?:\+?256[\s.-]?(?:0)?[37]\d|0[37]\d)(?:[\s.-]?\d){7,8}\b/g, "[REDACTED_CONTACT]")
    // Ugandan National Identification Number (NIN): 14 characters starting with CM or CF
    .replace(/\b[CF][MF][0-9A-HJ-NP-RT-Z]{12}\b/gi, "[REDACTED_NIN]")
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .slice(0, 300);
}

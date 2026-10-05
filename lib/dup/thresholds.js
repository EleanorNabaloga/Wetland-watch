// Tuning constants for duplicate detection.
//
// The starting values come from the design note. Wetland photos (green plants,
// brown water) look alike, so these MUST be re-measured on real photos with
// `npm run tune -- <folder-of-photos>` before they are trusted in production.
//
// Distance is Hamming distance out of 64 bits between two difference hashes.
//   0 - 5   same photo, reject
//   6 - 10  possibly the same photo, accept but flag for NEMA review
//   11 +    different photo, accept

/** Hamming distance at or below which two photos are treated as the same image. */
export const REJECT_DISTANCE = 5;

/** Hamming distance at or below which a photo is accepted but flagged for review. */
export const FLAG_DISTANCE = 10;

/** Number of bits in a difference hash. */
export const HASH_BITS = 64;

/**
 * Reports closer together than this describe the same place. The same pollution
 * photographed by two people standing in the same spot is one incident, not fraud.
 */
export const SAME_PLACE_M = 300;

/**
 * A photo reused further than this from the report it matches is claiming a
 * different place. That is the classic reuse pattern, so it is treated as fraud
 * rather than as a second report of one incident.
 */
export const DIFFERENT_PLACE_M = 500;

/** Reports of one incident further apart in time than this are treated as new. */
export const SAME_INCIDENT_HOURS = 48;

/**
 * How many stored hashes to load into memory when comparing. The full scan is
 * exact and fine for a pilot of a few thousand reports; past this the chunk
 * index is used instead.
 */
export const FULL_SCAN_LIMIT = 25000;

/** Hard ceiling on candidate rows pulled from the database in one check. */
export const MAX_CANDIDATES = 50000;

export const DUPLICATE_STATUS = {
  ACCEPT: "accept",
  GROUP: "group",
  FLAG: "flag",
  REJECT: "reject",
};

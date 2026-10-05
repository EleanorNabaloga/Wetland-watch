// Decide what a fingerprint match means.
//
// Kept pure and free of database calls so the rules can be unit tested and
// re-tuned without touching storage.
//
// Three layers, as in the design note:
//   1. identical bytes               -> reject
//   2. near identical picture        -> reject, or flag when it claims another place
//   3. same place, different picture -> group into the existing incident
//
// The same picture used to claim two different places is the fraud pattern, so
// a match far from the report it matches is always treated as a duplicate even
// at a distance that would otherwise only be flagged.

import { distanceM } from "../geo.js";
import {
  REJECT_DISTANCE,
  FLAG_DISTANCE,
  SAME_PLACE_M,
  DIFFERENT_PLACE_M,
  SAME_INCIDENT_HOURS,
  DUPLICATE_STATUS,
} from "./thresholds.js";

export const DUPLICATE_REASONS = {
  EXACT: "exact_duplicate",
  EXACT_ELSEWHERE: "exact_duplicate_claimed_elsewhere",
  NEAR: "near_duplicate",
  NEAR_ELSEWHERE: "near_duplicate_claimed_elsewhere",
  POSSIBLE: "possible_duplicate",
  POSSIBLE_ELSEWHERE: "possible_reuse_in_another_place",
  SAME_INCIDENT: "same_incident",
};

/** The id a report should be filed under: the matched report's case, or itself. */
function caseOf(candidate) {
  return candidate.caseId || candidate.id;
}

/**
 * Classify a fingerprint match.
 *
 * @param {object} input
 * @param {"exact"|"near"} input.kind  which layer produced the match
 * @param {number} input.distance      Hamming distance; 0 when bytes are identical
 * @param {object} input.candidate     the stored report that matched
 * @param {number} input.lat           latitude of the new report
 * @param {number} input.lng           longitude of the new report
 * @param {number} input.ts            capture time of the new report, ms
 */
export function classifyMatch({ kind, distance, candidate, lat, lng, ts }) {
  const metres = distanceM(
    { lat, lng },
    { lat: candidate.lat, lng: candidate.lng },
  );
  const samePlace = metres <= SAME_PLACE_M;
  const elsewhere = metres > DIFFERENT_PLACE_M;
  const hoursApart = Math.abs(ts - candidate.ts) / 3_600_000;
  const matchId = candidate.id;
  const caseId = caseOf(candidate);

  if (kind === "exact" || distance <= REJECT_DISTANCE) {
    return {
      status: DUPLICATE_STATUS.REJECT,
      reason: elsewhere
        ? kind === "exact"
          ? DUPLICATE_REASONS.EXACT_ELSEWHERE
          : DUPLICATE_REASONS.NEAR_ELSEWHERE
        : kind === "exact"
          ? DUPLICATE_REASONS.EXACT
          : DUPLICATE_REASONS.NEAR,
      matchId,
      caseId,
      distance,
      metres,
    };
  }

  if (distance <= FLAG_DISTANCE) {
    if (samePlace && hoursApart <= SAME_INCIDENT_HOURS) {
      return {
        status: DUPLICATE_STATUS.GROUP,
        reason: DUPLICATE_REASONS.SAME_INCIDENT,
        matchId,
        caseId,
        distance,
        metres,
      };
    }
    return {
      status: DUPLICATE_STATUS.FLAG,
      reason: elsewhere
        ? DUPLICATE_REASONS.POSSIBLE_ELSEWHERE
        : DUPLICATE_REASONS.POSSIBLE,
      matchId,
      caseId,
      distance,
      metres,
    };
  }

  return {
    status: DUPLICATE_STATUS.ACCEPT,
    reason: "",
    matchId: null,
    caseId: null,
    distance: null,
    metres: null,
  };
}

/**
 * Nearest match in a candidate list, or null when nothing is close enough.
 * `distanceOf(phash, phashFlip, candidate)` returns a distance or null.
 */
export function nearestMatch({ phash, phashFlip }, candidates, distanceOf) {
  let best = null;
  for (const candidate of candidates) {
    const distance = distanceOf(phash, phashFlip, candidate);
    if (distance == null) continue;
    if (!best || distance < best.distance) best = { candidate, distance };
    if (distance === 0) break;
  }
  return best;
}

// Duplicate detection entry point.
//
// `inspectPhoto` is the only function the report route needs. It hashes the
// bytes the server received, looks for the same file, then for the same
// picture, then applies the context rules, and returns a decision.
//
// The store is injected so the rules can be exercised without a database.

import {
  sha256Hex,
  hashPhoto,
  hexToBits,
  toWords,
  hammingWords,
  allChunkKeys,
} from "./hash.js";
import { classifyMatch, nearestMatch } from "./classify.js";
import {
  FULL_SCAN_LIMIT,
  MAX_CANDIDATES,
  DUPLICATE_STATUS,
} from "./thresholds.js";

/** Hamming distance from either the photo's hash or its mirror to a stored hash. */
export function distanceToCandidate(phash, phashFlip, candidate) {
  const stored = hexToBits(candidate.phash);
  if (stored == null) return null;
  const storedWords = toWords(stored);
  return Math.min(
    hammingWords(toWords(phash), storedWords),
    hammingWords(toWords(phashFlip), storedWords),
  );
}

async function loadCandidates(store, hashes) {
  const total = await store.countHashedReports();
  if (total <= FULL_SCAN_LIMIT) {
    return store.listPhashCandidates({ limit: MAX_CANDIDATES });
  }
  // Past the pilot the full scan is too wide, so narrow by shared byte slices
  // first. Two hashes less than 8 bits apart always share a slice, so no
  // rejection is lost.
  return store.listPhashCandidates({
    limit: MAX_CANDIDATES,
    chunkKeys: allChunkKeys(hashes),
  });
}

const CLEAN = {
  status: DUPLICATE_STATUS.ACCEPT,
  reason: "",
  matchId: null,
  caseId: null,
  distance: null,
  metres: null,
};

/**
 * Compare a photo against everything already stored.
 *
 * @param {object} input
 * @param {Buffer} input.buffer  bytes exactly as received
 * @param {number} input.lat
 * @param {number} input.lng
 * @param {number} input.ts      capture time, ms
 * @param {object} input.store   see `dupStore` in lib/db
 * @returns {Promise<object>} the decision, plus the fingerprints to store
 */
export async function inspectPhoto({ buffer, lat, lng, ts, store }) {
  const sha = sha256Hex(buffer);
  const hashes = await hashPhoto(buffer);

  const exact = await store.findReportByPhotoSha(sha);
  if (exact) {
    const decision = classifyMatch({
      kind: "exact",
      distance: 0,
      candidate: exact,
      lat,
      lng,
      ts,
    });
    return { sha, ...hashes, exact: true, decision };
  }

  const candidates = await loadCandidates(store, hashes);
  const best = nearestMatch(hashes, candidates, distanceToCandidate);
  if (!best) {
    return { sha, ...hashes, exact: false, decision: CLEAN };
  }

  const decision = classifyMatch({
    kind: "near",
    distance: best.distance,
    candidate: best.candidate,
    lat,
    lng,
    ts,
  });
  return { sha, ...hashes, exact: false, decision };
}

/** The fingerprints to persist for a report the server is going to store. */
export function fingerprintsToStore(result) {
  return {
    photoSha: result.sha,
    phash: result.phashHex,
    chunkKeys: allChunkKeys(result),
    dupStatus: result.decision.status,
    dupReason: result.decision.reason,
    dupOf: result.decision.matchId,
    dupDistance: result.decision.distance,
    caseId: result.decision.caseId,
  };
}

/** True when the report must not be stored at all. */
export function isRejected(result) {
  return result.decision.status === DUPLICATE_STATUS.REJECT;
}

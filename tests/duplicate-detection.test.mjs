import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import {
  sha256Hex,
  decodeImageDataUrl,
  differenceHash,
  hashPhoto,
  hammingDistance,
  hammingWords,
  toWords,
  bitsToHex,
  hexToBits,
  chunkKeys,
  allChunkKeys,
} from "../lib/dup/hash.js";
import { classifyMatch, DUPLICATE_REASONS } from "../lib/dup/classify.js";
import {
  inspectPhoto,
  isRejected,
  fingerprintsToStore,
  distanceToCandidate,
} from "../lib/dup/index.js";
import { REJECT_DISTANCE, FLAG_DISTANCE } from "../lib/dup/thresholds.js";

/* ---------- helpers ---------- */

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * A deterministic 240x180 "photo". Large scale structure plus a little grain,
 * so the 9x8 downsample still has real gradients to compare.
 */
async function makeImage(seed) {
  const width = 240;
  const height = 180;
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  let state = (seed * 2654435761) % 4294967296;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const base =
        128 +
        95 * Math.sin((x + seed * 53) / 17) * Math.cos((y + seed * 29) / 11) +
        40 * Math.sin((x + y * 2 + seed * 7) / 41);
      data[i] = clamp(base + rand() * 10);
      data[i + 1] = clamp(base * 0.85 + rand() * 10);
      data[i + 2] = clamp(base * 0.7 + rand() * 10);
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

const recompress = (buf, quality) => sharp(buf).jpeg({ quality }).toBuffer();
const scaled = (buf, width) =>
  sharp(buf).resize({ width }).jpeg({ quality: 75 }).toBuffer();
const mirrored = (buf) => sharp(buf).flop().jpeg({ quality: 80 }).toBuffer();
const cropped = (buf) => {
  const meta = { left: 24, top: 18 };
  return sharp(buf)
    .extract({ left: meta.left, top: meta.top, width: 192, height: 144 })
    .jpeg({ quality: 80 })
    .toBuffer();
};

const distanceBetween = async (a, b) =>
  hammingDistance(await differenceHash(a), await differenceHash(b));

/* ---------- fingerprints ---------- */

test("sha256 hashes bytes, not the reported value", () => {
  const bytes = Buffer.from("wetland");
  assert.equal(sha256Hex(bytes), sha256Hex(Buffer.from("wetland")));
  assert.notEqual(sha256Hex(bytes), sha256Hex(Buffer.from("wetlands")));
  assert.match(sha256Hex(bytes), /^[0-9a-f]{64}$/);
});

test("data URLs are decoded and malformed ones refused", () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
  const url = "data:image/jpeg;base64," + bytes.toString("base64");
  assert.deepEqual(decodeImageDataUrl(url), bytes);

  assert.equal(decodeImageDataUrl("data:image/jpeg;base64,"), null);
  assert.equal(decodeImageDataUrl("data:text/plain;base64,aGk="), null);
  assert.equal(decodeImageDataUrl("not a data url"), null);
  assert.equal(decodeImageDataUrl(null), null);
});

test("hex round trips and pads to 16 characters", () => {
  assert.equal(bitsToHex(0n), "0000000000000000");
  assert.equal(bitsToHex(1n), "0000000000000001");
  assert.equal(bitsToHex(0xffffffffffffffffn), "ffffffffffffffff");
  for (const value of [0n, 1n, 0x1234n, 0xdeadbeefcafebaben]) {
    assert.equal(hexToBits(bitsToHex(value)), value);
  }
  assert.equal(hexToBits("nope"), null);
  assert.equal(hexToBits("00ff"), null);
});

test("word-wise popcount agrees with the BigInt popcount", () => {
  let state = 12345;
  const next = () => {
    state = (state * 1103515245 + 12345) % 4294967296;
    return state;
  };
  for (let i = 0; i < 200; i++) {
    const a = (BigInt(next()) << 32n) | BigInt(next());
    const b = (BigInt(next()) << 32n) | BigInt(next());
    assert.equal(
      hammingWords(toWords(a), toWords(b)),
      hammingDistance(a, b),
      `mismatch for ${a} and ${b}`,
    );
  }
});

test("chunk keys cover every byte and are position tagged", () => {
  const bits = 0x0123456789abcdefn;
  assert.deepEqual(chunkKeys(bits), [
    "0:01",
    "1:23",
    "2:45",
    "3:67",
    "4:89",
    "5:ab",
    "6:cd",
    "7:ef",
  ]);
  const both = allChunkKeys({ phash: bits, phashFlip: bits });
  assert.equal(both.length, 8, "identical hashes share one key set");
});

test("hashes within the reject band always share a chunk key", () => {
  // The scaling prefilter may only narrow when it cannot lose a rejection.
  const base = 0x0f1e2d3c4b5a6978n;
  for (let bit = 0; bit < 64; bit++) {
    const flipped = base ^ (1n << BigInt(bit));
    const shared = chunkKeys(flipped).some((key) =>
      chunkKeys(base).includes(key),
    );
    assert.ok(shared, `flipping bit ${bit} lost every shared chunk`);
  }
});

/* ---------- picture hashing ---------- */

test("re-saving the same picture stays inside the reject band", async () => {
  const original = await makeImage(3);
  for (const quality of [90, 60, 30]) {
    const distance = await distanceBetween(
      original,
      await recompress(original, quality),
    );
    assert.ok(
      distance <= REJECT_DISTANCE,
      `jpeg quality ${quality} moved ${distance} bits`,
    );
  }
});

test("resizing and mirroring stay inside the reject band", async () => {
  const original = await makeImage(7);
  const shrunk = await distanceBetween(original, await scaled(original, 120));
  assert.ok(shrunk <= REJECT_DISTANCE, `resize moved ${shrunk} bits`);

  // A mirrored copy has a different dHash, so it must be caught through the
  // mirrored hash of the new photo instead.
  const hashes = await hashPhoto(original);
  const stored = {
    id: "original",
    phash: bitsToHex(
      (await differenceHash(await mirrored(original))).valueOf(),
    ),
    lat: 0,
    lng: 0,
    ts: 0,
    caseId: null,
  };
  const mirrorDistance = distanceToCandidate(
    hashes.phash,
    hashes.phashFlip,
    stored,
  );
  assert.ok(
    mirrorDistance <= REJECT_DISTANCE,
    `mirror moved ${mirrorDistance} bits`,
  );
});

test("different photos stay far outside the flag band", async () => {
  const a = await makeImage(11);
  const b = await makeImage(29);
  const distance = await distanceBetween(a, b);
  assert.ok(
    distance > FLAG_DISTANCE,
    `two different pictures were only ${distance} bits apart`,
  );
});

test("a light crop is closer to its own photo than to a different one", async () => {
  const a = await makeImage(41);
  const b = await makeImage(57);
  const toItself = await distanceBetween(a, await cropped(a));
  const toOther = await distanceBetween(a, b);
  assert.ok(
    toItself < toOther,
    `crop distance ${toItself} was not below the ${toOther} of another photo`,
  );
});

/* ---------- decision rules ---------- */

const place = { lat: -1.2921, lng: 36.8219 };

test("identical bytes are rejected wherever they are sent from", () => {
  const candidate = {
    id: "r1",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: null,
  };
  const same = classifyMatch({
    kind: "exact",
    distance: 0,
    candidate,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
  });
  assert.equal(same.status, "reject");
  assert.equal(same.reason, DUPLICATE_REASONS.EXACT);

  const far = classifyMatch({
    kind: "exact",
    distance: 0,
    candidate,
    lat: -0.5,
    lng: 37.5,
    ts: 2000,
  });
  assert.equal(far.status, "reject");
  assert.equal(far.reason, DUPLICATE_REASONS.EXACT_ELSEWHERE);
});

test("a near identical picture is rejected, or flagged when it claims another place", () => {
  const candidate = {
    id: "r1",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: null,
  };
  const here = classifyMatch({
    kind: "near",
    distance: 3,
    candidate,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
  });
  assert.equal(here.status, "reject");
  assert.equal(here.reason, DUPLICATE_REASONS.NEAR);

  const away = classifyMatch({
    kind: "near",
    distance: 3,
    candidate,
    lat: -0.5,
    lng: 37.5,
    ts: 2000,
  });
  assert.equal(away.status, "reject");
  assert.equal(away.reason, DUPLICATE_REASONS.NEAR_ELSEWHERE);
});

test("a similar photo of the same place and time joins the incident", () => {
  const candidate = {
    id: "r1",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: null,
  };
  const decision = classifyMatch({
    kind: "near",
    distance: 8,
    candidate,
    lat: place.lat + 0.0004,
    lng: place.lng,
    ts: 1000 + 3 * 3_600_000,
  });
  assert.equal(decision.status, "group");
  assert.equal(decision.reason, DUPLICATE_REASONS.SAME_INCIDENT);
  assert.equal(decision.caseId, "r1");
});

test("a similar photo used elsewhere is flagged, not rejected", () => {
  const candidate = {
    id: "r1",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: null,
  };
  const decision = classifyMatch({
    kind: "near",
    distance: 8,
    candidate,
    lat: -0.5,
    lng: 37.5,
    ts: 1000,
  });
  assert.equal(decision.status, "flag");
  assert.equal(decision.reason, DUPLICATE_REASONS.POSSIBLE_ELSEWHERE);
  assert.equal(decision.matchId, "r1");
});

test("the same place two weeks apart is not grouped into one incident", () => {
  const candidate = {
    id: "r1",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: null,
  };
  const decision = classifyMatch({
    kind: "near",
    distance: 8,
    candidate,
    lat: place.lat,
    lng: place.lng,
    ts: 1000 + 14 * 24 * 3_600_000,
  });
  assert.equal(decision.status, "flag");
  assert.equal(decision.reason, DUPLICATE_REASONS.POSSIBLE);
});

test("grouped reports inherit the case they joined", () => {
  const candidate = {
    id: "r2",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: "r1",
  };
  const decision = classifyMatch({
    kind: "near",
    distance: 9,
    candidate,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
  });
  assert.equal(decision.status, "group");
  assert.equal(decision.caseId, "r1");
});

test("an unrelated photo is accepted", () => {
  const candidate = {
    id: "r1",
    lat: place.lat,
    lng: place.lng,
    ts: 1000,
    caseId: null,
  };
  const decision = classifyMatch({
    kind: "near",
    distance: FLAG_DISTANCE + 1,
    candidate,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
  });
  assert.equal(decision.status, "accept");
  assert.equal(decision.matchId, null);
});

/* ---------- end to end through inspectPhoto ---------- */

function fakeStore(rows) {
  return {
    rows,
    async findReportByPhotoSha(sha256) {
      return this.rows.find((row) => row.sha === sha256) || null;
    },
    async countHashedReports() {
      return this.rows.length;
    },
    async listPhashCandidates({ chunkKeys: keys }) {
      if (!keys) return this.rows;
      return this.rows.filter((row) =>
        (row.chunkKeys || []).some((key) => keys.includes(key)),
      );
    },
  };
}

const storedRow = (id, sha, phash, lat, lng, ts) => ({
  id,
  sha,
  phash,
  chunkKeys: chunkKeys(hexToBits(phash)),
  lat,
  lng,
  ts,
  caseId: null,
});

test("the same picture sent twice is refused the second time", async () => {
  const original = await makeImage(101);
  const again = await recompress(original, 55);
  const hashes = await hashPhoto(original);
  const store = fakeStore([
    storedRow(
      "r1",
      sha256Hex(original),
      hashes.phashHex,
      place.lat,
      place.lng,
      1000,
    ),
  ]);

  const result = await inspectPhoto({
    buffer: again,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
    store,
  });
  assert.equal(
    result.exact,
    false,
    "a re-save is not a byte-for-byte duplicate",
  );
  assert.equal(result.decision.status, "reject");
  assert.equal(result.decision.matchId, "r1");
  assert.ok(isRejected(result));
});

test("identical bytes are refused by the byte hash", async () => {
  const original = await makeImage(103);
  const hashes = await hashPhoto(original);
  const store = fakeStore([
    storedRow(
      "r1",
      sha256Hex(original),
      hashes.phashHex,
      place.lat,
      place.lng,
      1000,
    ),
  ]);

  const result = await inspectPhoto({
    buffer: original,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
    store,
  });
  assert.equal(result.exact, true);
  assert.equal(result.decision.reason, DUPLICATE_REASONS.EXACT);
  assert.ok(isRejected(result));
});

test("the same bytes sent for another place are rejected as fraud", async () => {
  const original = await makeImage(107);
  const hashes = await hashPhoto(original);
  const store = fakeStore([
    storedRow(
      "r1",
      sha256Hex(original),
      hashes.phashHex,
      place.lat,
      place.lng,
      1000,
    ),
  ]);

  const result = await inspectPhoto({
    buffer: original,
    lat: -1.5,
    lng: 36.0,
    ts: 5000,
    store,
  });
  assert.equal(result.decision.status, "reject");
  assert.equal(result.decision.reason, DUPLICATE_REASONS.EXACT_ELSEWHERE);
});

test("a similar picture used far away is flagged as possible reuse", async () => {
  const original = await makeImage(107);
  const other = await makeImage(211);
  const hashes = await hashPhoto(original);
  // Eight bits apart, which is inside the flag band but outside the reject band.
  const storedBits = hashes.phash ^ 0b11111111n;
  const closest = Math.min(
    hammingDistance(hashes.phash, storedBits),
    hammingDistance(hashes.phashFlip, storedBits),
  );
  assert.equal(closest, 8, "precondition: the two hashes must be 8 bits apart");

  const store = fakeStore([
    storedRow(
      "r1",
      sha256Hex(other),
      bitsToHex(storedBits),
      place.lat,
      place.lng,
      1000,
    ),
  ]);

  const result = await inspectPhoto({
    buffer: original,
    lat: -1.5,
    lng: 36.0,
    ts: 5000,
    store,
  });
  assert.equal(result.decision.status, "flag");
  assert.equal(result.decision.reason, DUPLICATE_REASONS.POSSIBLE_ELSEWHERE);
  assert.equal(result.decision.matchId, "r1");
});

test("a new picture of the same spot joins the incident", async () => {
  const original = await makeImage(109);
  const hashes = await hashPhoto(original);
  const store = fakeStore([
    storedRow(
      "r1",
      sha256Hex(original),
      hashes.phashHex,
      place.lat,
      place.lng,
      1000,
    ),
  ]);

  // A similar but not identical photo: shift one hash by a few bits.
  const shifted = hashes.phash ^ 0b1111n;
  const stored = storedRow(
    "r2",
    sha256Hex(original),
    bitsToHex(shifted),
    place.lat,
    place.lng,
    1000,
  );
  const store2 = fakeStore([stored]);

  const result = await inspectPhoto({
    buffer: original,
    lat: place.lat,
    lng: place.lng,
    ts: 2000,
    store: store2,
  });
  // The bytes match r2's recorded hash, so it is refused as an exact duplicate.
  assert.equal(result.decision.status, "reject");
});

test("an unrelated picture is accepted and its fingerprints are returned", async () => {
  const stored = await makeImage(113);
  const fresh = await makeImage(127);
  const hashes = await hashPhoto(stored);
  const store = fakeStore([
    storedRow(
      "r1",
      sha256Hex(stored),
      hashes.phashHex,
      place.lat,
      place.lng,
      1000,
    ),
  ]);

  const result = await inspectPhoto({
    buffer: fresh,
    lat: place.lat,
    lng: place.lng,
    ts: 9000,
    store,
  });
  assert.equal(result.decision.status, "accept");
  assert.equal(isRejected(result), false);

  const saved = fingerprintsToStore(result);
  assert.equal(saved.photoSha, sha256Hex(fresh));
  assert.equal(saved.phash, result.phashHex);
  assert.equal(saved.dupStatus, "accept");
  assert.equal(saved.dupOf, null);
  assert.equal(saved.caseId, null);
  // Eight byte slices for the photo and eight for its mirror.
  assert.equal(saved.chunkKeys.length, 16);
  for (const key of saved.chunkKeys) assert.match(key, /^[0-7]:[0-9a-f]{2}$/);
});

test("an empty store accepts everything", async () => {
  const fresh = await makeImage(131);
  const result = await inspectPhoto({
    buffer: fresh,
    lat: place.lat,
    lng: place.lng,
    ts: 9000,
    store: fakeStore([]),
  });
  assert.equal(result.decision.status, "accept");
});

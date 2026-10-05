// Server-side photo fingerprinting. Always called with the bytes the server
// received, never with anything the phone sent.
//
// Two levels:
//   * SHA-256 of the file bytes - the same file sent twice.
//   * 64-bit difference hash (dHash) - the same picture re-saved, resized,
//     recompressed, screenshotted, lightly cropped or mirrored.

import crypto from "node:crypto";
import sharp from "sharp";

/** Sample grid. Nine columns give eight horizontal comparisons per row. */
const SAMPLE_WIDTH = 9;
const SAMPLE_HEIGHT = 8;
const COMPARISONS_PER_ROW = SAMPLE_WIDTH - 1;

/** SHA-256 of raw bytes, as lowercase hex. */
export function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Pull the bytes out of a `data:image/...;base64,...` URL.
 * Returns null when the value is not a usable base64 image data URL.
 */
export function decodeImageDataUrl(value) {
  if (typeof value !== "string") return null;
  const comma = value.indexOf(",");
  if (comma < 0) return null;
  const header = value.slice(0, comma);
  if (!/^data:image\/[a-z0-9.+-]+;base64$/i.test(header)) return null;
  const encoded = value.slice(comma + 1);
  if (!encoded) return null;
  const buffer = Buffer.from(encoded, "base64");
  return buffer.length ? buffer : null;
}

/** Read an image into an 8x9 buffer of greyscale pixel values. */
async function sampleGrey(buffer, transform) {
  let pipeline = sharp(buffer, { failOn: "none" }).rotate();
  if (transform === "flop") pipeline = pipeline.flop();
  const { data } = await pipeline
    .greyscale()
    .resize(SAMPLE_WIDTH, SAMPLE_HEIGHT, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/** 64 bits: 1 where a pixel is brighter than its right neighbour. */
function bitsFromSamples(data) {
  let bits = 0n;
  for (let y = 0; y < SAMPLE_HEIGHT; y++) {
    for (let x = 0; x < COMPARISONS_PER_ROW; x++) {
      const left = data[y * SAMPLE_WIDTH + x];
      const right = data[y * SAMPLE_WIDTH + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits;
}

/**
 * 64-bit difference hash of an image. `transform: "flop"` hashes the mirrored
 * copy, which is what catches someone flipping a photo to reuse it.
 */
export async function differenceHash(buffer, transform = "none") {
  const samples = await sampleGrey(buffer, transform);
  return bitsFromSamples(samples);
}

/** Both hashes of one photo: as it is, and mirrored. */
export async function hashPhoto(buffer) {
  const [phash, phashFlip] = await Promise.all([
    differenceHash(buffer, "none"),
    differenceHash(buffer, "flop"),
  ]);
  return {
    phash,
    phashFlip,
    phashHex: bitsToHex(phash),
    phashFlipHex: bitsToHex(phashFlip),
  };
}

/** 64-bit value as a 16 character hex string. */
export function bitsToHex(bits) {
  return bits.toString(16).padStart(16, "0");
}

/** Parse a stored hex hash. Null when the value is not 16 hex characters. */
export function hexToBits(hex) {
  if (typeof hex !== "string" || !/^[0-9a-f]{16}$/i.test(hex)) return null;
  return BigInt("0x" + hex.toLowerCase());
}

/**
 * Split a hash into two 32-bit halves so the matcher can use fast integer
 * popcounts instead of BigInt arithmetic.
 */
export function toWords(bits) {
  return {
    hi: Number((bits >> 32n) & 0xffffffffn),
    lo: Number(bits & 0xffffffffn),
  };
}

function popcount32(value) {
  let n = value - ((value >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0f0f0f0f;
  return (n * 0x01010101) >>> 24;
}

/** Number of differing bits between two hashes held as word pairs, 0-64. */
export function hammingWords(a, b) {
  return popcount32((a.hi ^ b.hi) >>> 0) + popcount32((a.lo ^ b.lo) >>> 0);
}

/** Number of differing bits between two BigInt hashes, 0-64. */
export function hammingDistance(a, b) {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** How many byte slices each hash is split into for the scaling prefilter. */
export const CHUNK_COUNT = 8;

/**
 * Chunk keys for a hash: one `position:byte` string per 8-bit slice.
 *
 * Two hashes differing in fewer than 8 bits necessarily share at least one
 * slice, so indexing these and comparing only rows that share a key loses no
 * match inside the reject band. Used once the table is too big for a full scan.
 */
export function chunkKeys(bits) {
  const hex = bitsToHex(bits);
  const keys = [];
  for (let i = 0; i < CHUNK_COUNT; i++) {
    keys.push(`${i}:${hex.slice(i * 2, i * 2 + 2)}`);
  }
  return keys;
}

/** Chunk keys for a photo's normal and mirrored hash, de-duplicated. */
export function allChunkKeys(hashes) {
  return [
    ...new Set([...chunkKeys(hashes.phash), ...chunkKeys(hashes.phashFlip)]),
  ];
}

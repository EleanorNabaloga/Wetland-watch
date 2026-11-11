// Measure the duplicate-detection thresholds on real photos.
//
//   npm run tune -- <folder-of-photos>
//
// Put JPEG/PNG photos in a folder. Optionally group photos of the same scene
// (same place, different shot) into subfolders: photos/lubigi/1.jpg, ...
//
// The script reports three kinds of distance (bits different, out of 64):
//   1. Same photo, saved again: each photo is resized, recompressed and
//      mirrored, the way a reused photo usually arrives. These must be at or
//      below REJECT_DISTANCE so reused photos are refused.
//   2. Same scene, different shot (subfolders only): these should usually be
//      above REJECT_DISTANCE, so two people reporting one problem are not refused.
//   3. Different photos: these must stay above REJECT_DISTANCE, and ideally
//      above FLAG_DISTANCE, or honest reports get refused or flagged.
// Then it prints the share of each kind that the current thresholds would
// reject or flag. Nothing is written anywhere.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { hashPhoto, toWords, hammingWords } from "../lib/dup/hash.js";
import { REJECT_DISTANCE, FLAG_DISTANCE } from "../lib/dup/thresholds.js";

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.log("Use: npm run tune -- <folder-of-photos>");
  process.exit(1);
}

const IMAGE = /\.(jpe?g|png|webp)$/i;
function listPhotos(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const f of fs.readdirSync(full)) if (IMAGE.test(f)) out.push({ file: path.join(full, f), scene: entry.name });
    } else if (IMAGE.test(entry.name)) out.push({ file: full, scene: null });
  }
  return out;
}

// Smallest distance between two photos, counting a mirrored copy as the same.
function distance(a, b) {
  const bw = toWords(b.phash);
  return Math.min(hammingWords(toWords(a.phash), bw), hammingWords(toWords(a.phashFlip), bw));
}

// Ways a reused photo is typically changed on its way back in.
const VARIANTS = {
  "resized to 1280 px, quality 70": (img) => img.resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 70 }),
  "small, quality 40 (messaging app)": (img) => img.resize({ width: 640 }).jpeg({ quality: 40 }),
  "mirrored": (img) => img.flop().jpeg({ quality: 85 }),
  "brightened 15%": (img) => img.modulate({ brightness: 1.15 }).jpeg({ quality: 85 }),
};

const photos = listPhotos(dir);
if (photos.length < 2) {
  console.log("Need at least 2 photos in " + dir);
  process.exit(1);
}
console.log(`Hashing ${photos.length} photos...`);

const hashed = [];
const resaved = [];
for (const p of photos) {
  const buffer = fs.readFileSync(p.file);
  let h;
  try {
    h = await hashPhoto(buffer);
  } catch (error) {
    console.log("  skipped (unreadable): " + p.file);
    continue;
  }
  hashed.push({ ...p, ...h });
  for (const [label, make] of Object.entries(VARIANTS)) {
    const copy = await make(sharp(buffer).rotate()).toBuffer();
    const d = distance(h, await hashPhoto(copy));
    resaved.push({ d, label: path.basename(p.file) + ", " + label });
  }
}

const sameScene = [];
const different = [];
for (let i = 0; i < hashed.length; i++) {
  for (let j = i + 1; j < hashed.length; j++) {
    const a = hashed[i];
    const b = hashed[j];
    const d = distance(a, b);
    const label = path.basename(a.file) + " vs " + path.basename(b.file);
    if (a.scene && a.scene === b.scene) sameScene.push({ d, label });
    else different.push({ d, label });
  }
}

const pct = (n, total) => (total ? ((100 * n) / total).toFixed(1) + "%" : "-");
function summary(title, rows) {
  console.log("\n" + title + ` (${rows.length} pairs)`);
  if (!rows.length) return console.log("  none");
  const ds = rows.map((r) => r.d).sort((a, b) => a - b);
  const q = (f) => ds[Math.min(ds.length - 1, Math.floor(f * ds.length))];
  console.log(`  min ${ds[0]}, 10% ${q(0.1)}, median ${q(0.5)}, 90% ${q(0.9)}, max ${ds[ds.length - 1]}`);
  const rejected = ds.filter((d) => d <= REJECT_DISTANCE).length;
  const flagged = ds.filter((d) => d > REJECT_DISTANCE && d <= FLAG_DISTANCE).length;
  console.log(`  refused at <= ${REJECT_DISTANCE}: ${pct(rejected, ds.length)}   flagged at <= ${FLAG_DISTANCE}: ${pct(flagged, ds.length)}`);
  return ds;
}

const r = summary("1. Same photo, saved again (should all be refused)", resaved);
summary("2. Same scene, different shot", sameScene);
const d = summary("3. Different photos (should not be refused)", different);

const missed = resaved.filter((x) => x.d > REJECT_DISTANCE).sort((a, b) => b.d - a.d).slice(0, 5);
if (missed.length) {
  console.log("\nReused copies that would get through:");
  for (const x of missed) console.log(`  ${x.d}  ${x.label}`);
}
const close = different.filter((x) => x.d <= FLAG_DISTANCE).sort((a, b) => a.d - b.d).slice(0, 5);
if (close.length) {
  console.log("\nDifferent photos that look alike to the hash:");
  for (const x of close) console.log(`  ${x.d}  ${x.label}`);
}

if (r && d) {
  const maxResaved = r[r.length - 1];
  const minDifferent = d[0];
  console.log("\nSuggestion:");
  if (maxResaved < minDifferent) {
    console.log(`  Re-saved copies reach ${maxResaved}; different photos start at ${minDifferent}.`);
    console.log(`  Any REJECT_DISTANCE from ${maxResaved} to ${minDifferent - 1} separates them on these photos.`);
  } else {
    console.log(`  The groups overlap (re-saved up to ${maxResaved}, different from ${minDifferent}).`);
    console.log("  No single threshold separates them; keep the flag band and let reviewers decide.");
  }
  console.log("  Edit lib/dup/thresholds.js, then run npm test.");
}

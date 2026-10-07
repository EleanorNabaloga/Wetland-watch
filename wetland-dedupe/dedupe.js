import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';

const STORE = 'store.json';
const load = () => (fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : []);
const save = (rows) => fs.writeFileSync(STORE, JSON.stringify(rows, null, 2));

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export async function dHash(buf) {
  const { data, info } = await sharp(buf)
    .rotate()
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[(y * 9 + x) * ch];
      const right = data[(y * 9 + x + 1) * ch];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits;
}

export function hamming(a, b) {
  let x = a ^ b, count = 0;
  while (x) { count += Number(x & 1n); x >>= 1n; }
  return count;
}

export async function checkDuplicate(buf) {
  const rows = load();
  const sha = sha256(buf);

  const exact = rows.find((r) => r.sha === sha);
  if (exact) return { status: 'reject', reason: 'exact_duplicate', matchId: exact.id };

  const hash = await dHash(buf);
  const phash = hash.toString(16).padStart(16, '0');

  let best = { dist: 65, id: null };
  for (const r of rows) {
    const d = hamming(hash, BigInt('0x' + r.phash));
    if (d < best.dist) best = { dist: d, id: r.id };
  }

  if (best.dist <= 5)  return { status: 'reject', reason: 'near_duplicate', matchId: best.id, distance: best.dist };
  if (best.dist <= 10) return { status: 'flag', reason: 'possible_duplicate', matchId: best.id, distance: best.dist, sha, phash };
  return { status: 'accept', sha, phash };
}

export function saveReport(id, sha, phash) {
  const rows = load();
  rows.push({ id, sha, phash });
  save(rows);
}

import sharp from 'sharp';
import fs from 'fs';
import { checkDuplicate, saveReport } from './dedupe.js';

if (fs.existsSync('store.json')) fs.unlinkSync('store.json');

async function makeImage(a, b, c) {
  const w = 600, h = 400, raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    raw[i]     = 128 + 127 * Math.sin(x * a + y * c);
    raw[i + 1] = 128 + 127 * Math.cos(y * b + x * c);
    raw[i + 2] = 128 + 127 * Math.sin((x + y) * (a + b));
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

const original  = await makeImage(0.02, 0.03, 0.01);
const different = await makeImage(0.05, 0.011, 0.04);
const resized   = await sharp(original).resize(300, 200).jpeg({ quality: 40 }).toBuffer();
const brighter  = await sharp(original).modulate({ brightness: 1.15 }).jpeg({ quality: 70 }).toBuffer();

async function run(label, buf, id) {
  const r = await checkDuplicate(buf);
  console.log(label.padEnd(28), '->', r.status, r.reason ?? '', r.distance !== undefined ? `(distance ${r.distance})` : '');
  if (r.status === 'accept') saveReport(id, r.sha, r.phash);
}

await run('1. original (first upload)', original, 'r1');
await run('2. same file again',         original, 'r2');
await run('3. resized + compressed',    resized,  'r3');
await run('4. brighter + recompressed', brighter, 'r4');
await run('5. a different image',       different,'r5');

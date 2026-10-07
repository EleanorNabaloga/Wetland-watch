import sharp from 'sharp';
import fs from 'fs';
import { submitReport, verifyReport, dismissReport, auditReport, confirmReport, getReporter } from './reports.js';

for (const f of ['reports.json', 'reporters.json', 'store.json']) if (fs.existsSync(f)) fs.unlinkSync(f);

async function photo(n) {
  const w = 600, h = 400, raw = Buffer.alloc(w * h * 3);
  const a = 0.011 + n * 0.0173, b = 0.007 + n * 0.0291, c = 0.003 + n * 0.0117;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    raw[i]     = 128 + 127 * Math.sin(x * a + y * c + n);
    raw[i + 1] = 128 + 127 * Math.cos(y * b + x * c * 2 + n * 2);
    raw[i + 2] = 128 + 127 * Math.sin((x * b + y * a) * 1.7 + n * 3);
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

const now = () => Date.now() - 10000;
const INSIDE = { lat: 0.335, lng: 32.535, accuracyM: 8 };
const OUTSIDE = { lat: 0.350, lng: 32.560, accuracyM: 8 };

function show(step, res) {
  const b = res.body;
  const rep = b.reporter ? `trust ${b.reporter.score} (${b.reporter.level})` : '';
  const what = b.decision ?? b.report?.status ?? b.error ?? '';
  const extra = b.report?.rewardStatus && b.report.status !== 'pending' ? ` reward=${b.report.rewardAmount} ${b.report.rewardStatus}` : '';
  const why = b.reasons ? ' [' + b.reasons.join('; ') + ']' : '';
  console.log(step.padEnd(40), '->', String(res.code), what + extra + why, '|', rep);
}

const p1 = await photo(1), p2 = await photo(7), p3 = await photo(13);
const U = 'user1';

let r = await submitReport(p1, { ...INSIDE, capturedAt: now(), reporterId: U });
show('1. good report', r);
const id1 = r.body.report.id;

show('2. same photo again', await submitReport(p1, { ...INSIDE, capturedAt: now(), reporterId: U }));
show('3. new photo, wrong place', await submitReport(p2, { ...OUTSIDE, capturedAt: now(), reporterId: U }));
show('4. new photo, weak GPS (retake)', await submitReport(p2, { ...INSIDE, accuracyM: 120, capturedAt: now(), reporterId: U }));
show('5. officer verifies report 1', verifyReport(id1));
show('6. second user confirms report 1', confirmReport(id1, 'user2'));
show('7. user cannot confirm own report', confirmReport(id1, U));

r = await submitReport(p2, { ...INSIDE, capturedAt: now(), reporterId: U });
show('8. second good report', r);
show('9. officer dismisses it as false', dismissReport(r.body.report.id, true));

r = await submitReport(p3, { ...INSIDE, capturedAt: now(), reporterId: U });
show('10. third good report', r);
show('11. officer verifies report 3', verifyReport(r.body.report.id));
show('12. random audit of report 3 FAILS', auditReport(r.body.report.id, false));

console.log('\nFinal reporter summary:');
const f = getReporter(U).body;
console.log(JSON.stringify({ score: f.score, level: f.level, rewardMultiplier: f.rewardMultiplier, dailyCap: f.dailyCap, review: f.review }, null, 2));

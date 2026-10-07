import fs from 'fs';
import { checkDuplicate, saveReport } from './dedupe.js';

for (const file of process.argv.slice(2)) {
  const r = await checkDuplicate(fs.readFileSync(file));
  console.log(file, '->', r.status, r.reason ?? '', r.distance ?? '');
  if (r.status === 'accept') saveReport(file, r.sha, r.phash);
}

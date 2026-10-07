import fs from 'fs';

const file = 'app/api/reports/route.js';
const plain = 'return fail(400, "That photo could not be read. Please take another one.");';
const debug = 'return fail(400, "That photo could not be read. Please take another one. DEBUG: " + (error && error.message));';

const mode = process.argv[2];
if (mode !== 'on' && mode !== 'off') {
  console.log('Use: node debug-toggle.mjs on   (or)   node debug-toggle.mjs off');
  process.exit(1);
}

const s = fs.readFileSync(file, 'utf8');
const [from, to] = mode === 'on' ? [plain, debug] : [debug, plain];

if (s.includes(to)) { console.log('Debug is already ' + mode.toUpperCase()); process.exit(0); }
if (!s.includes(from)) { console.log('Could not find the line to change - tell Claude'); process.exit(1); }

fs.writeFileSync(file, s.replace(from, to));
console.log('Debug is now ' + mode.toUpperCase() + ' in ' + file);

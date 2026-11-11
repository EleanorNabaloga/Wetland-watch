// Check the translations in lib/strings/.
//
//   node scripts/check-i18n.mjs      (or: npm run check:i18n)
//
// 1. Every language has exactly the English keys.
// 2. Placeholders like {n} and **bold** markers match English.
// 3. Every key the screens ask for exists, and every English key is used.
// 4. A few strings render as expected.
// Exits with code 1 if anything fails.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { MESSAGES as M, translate } from "../lib/messages.js";

const root = fileURLToPath(new URL("..", import.meta.url));
let problems = 0;
const bad = (m) => { problems++; console.log("  FAIL " + m); };
const ok = (m) => console.log("  ok   " + m);
const en = Object.keys(M.en);
const marks = (s) => ({
  ph: [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(","),
  bold: (s.match(/\*\*/g) || []).length,
});

console.log("1. Keys match English");
for (const code of Object.keys(M)) {
  const keys = Object.keys(M[code]);
  const missing = en.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !en.includes(k));
  if (missing.length) bad(code + " missing: " + missing.join(", "));
  if (extra.length) bad(code + " extra: " + extra.join(", "));
  if (!missing.length && !extra.length) ok(code + ": " + keys.length + " keys");
}

console.log("2. Placeholders and bold markers");
const before = problems;
for (const code of Object.keys(M).filter((c) => c !== "en")) {
  for (const k of en) {
    if (M[code][k] == null) continue;
    const a = marks(M.en[k]);
    const b = marks(M[code][k]);
    if (a.ph !== b.ph) bad(`${code} ${k}: placeholders differ ({${a.ph}} vs {${b.ph}})`);
    if (a.bold !== b.bold) bad(`${code} ${k}: ** markers differ`);
  }
}
if (problems === before) ok("all consistent");

console.log("3. Keys used by the screens");
// All app source except the string files themselves.
function sources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "strings") out.push(...sources(full));
    } else if (/\.(js|jsx|mjs)$/.test(name) && name !== "messages.js") out.push(full);
  }
  return out;
}
const files = ["app", "components", "lib"].flatMap((d) => sources(join(root, d)));
const code = files.map((f) => readFileSync(f, "utf8")).join("\n");

// Keys asked for directly: t("x"), translate(lang, "x"), or listed as key: "x".
const asked = new Set();
for (const m of code.matchAll(/\bt\(\s*"([\w.]+)"/g)) asked.add(m[1]);
for (const m of code.matchAll(/\btranslate\(\s*[^,]+,\s*"([\w.]+)"/g)) asked.add(m[1]);
for (const m of code.matchAll(/\bkey:\s*"([\w.]+)"/g)) asked.add(m[1]);
const before3 = problems;
for (const k of asked) if (!k.endsWith(".") && !M.en[k]) bad(`unknown key "${k}"`); // "outcome." + x is a prefix
if (problems === before3) ok(asked.size + " keys asked for, all exist");

// Keys built at run time, e.g. t("outcome." + key), count every key with that prefix.
const prefixes = [...code.matchAll(/"([\w]+\.)"\s*\+/g)].map((m) => m[1]);
const unused = en.filter(
  (k) => !code.includes('"' + k + '"') && !prefixes.some((p) => k.startsWith(p)),
);
console.log(unused.length ? "  note unused: " + unused.join(", ") : "  ok   no unused keys");
console.log("  (scanned " + files.map((f) => relative(root, f)).length + " files)");

console.log("4. Rendering");
const expect = (lang, key, vars, want) => {
  const got = translate(lang, key, vars);
  got === want ? ok(`${lang} ${key}`) : bad(`${lang} ${key}: got "${got}", want "${want}"`);
};
expect("sw", "time.min", { n: 5 }, "dakika 5 zilizopita");
expect("en", "gps.acc", { a: 12 }, "accurate to ±12 m");
expect("lg", "no.such.key", null, "no.such.key");
expect("xx", "time.hours", { n: 2 }, "2 h ago");

console.log(problems ? problems + " problem(s)" : "All checks passed");
process.exit(problems ? 1 : 0);

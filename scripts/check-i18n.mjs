import { readFileSync } from "node:fs";
import { __MESSAGES as M, translate, LANGS } from "../lib/i18n.js";
let problems = 0;
const bad = (m) => { problems++; console.log("  FAIL " + m); };
const ok = (m) => console.log("  ok   " + m);
const en = Object.keys(M.en);
const marks = (s) => ({ ph: [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(","), bold: (s.match(/\*\*/g) || []).length });
console.log("1. Keys match English");
for (const code of Object.keys(M)) {
  const keys = Object.keys(M[code]);
  const missing = en.filter((k) => !keys.includes(k)), extra = keys.filter((k) => !en.includes(k));
  if (missing.length) bad(code + " missing: " + missing.join(", "));
  if (extra.length) bad(code + " extra: " + extra.join(", "));
  if (!missing.length && !extra.length) ok(code + ": " + keys.length + " keys");
}
console.log("2. Placeholders and bold markers");
for (const code of Object.keys(M).filter((c) => c !== "en")) for (const k of en) {
  if (M[code][k] == null) continue;
  const a = marks(M.en[k]), b = marks(M[code][k]);
  if (a.ph !== b.ph) bad(code + " " + k + ": placeholders differ");
  if (a.bold !== b.bold) bad(code + " " + k + ": ** markers differ");
}
if (!problems) ok("all consistent");
console.log("3. Keys used in app/page.js");
const src = readFileSync(new URL("../app/page.js", import.meta.url), "utf8");
for (const m of src.matchAll(/\btr\(\s*"([\w.]+)"/g)) if (!m[1].endsWith(".") && !M.en[m[1]]) bad('unknown key "' + m[1] + '"');
const unused = en.filter((k) => !src.includes('"' + k + '"') && !(k.startsWith("type.") && src.includes('"type."')));
console.log(unused.length ? "  note unused: " + unused.join(", ") : "  ok   no unused keys");
console.log("4. Rendering");
translate("sw", "time.min", { n: 5 }) === "dakika 5 zilizopita" ? ok("sw time.min") : bad("sw time.min");
translate("en", "gps.good.sub", { c: "1,2", a: 12 }) === "1,2 · accurate to ±12 m" ? ok("en gps.good.sub") : bad("en gps.good.sub");
console.log(problems ? problems + " problem(s)" : "All checks passed");
process.exit(problems ? 1 : 0);

// All screen text, by language, and the function that fills it in.
// Plain JavaScript (no React), so scripts/check-i18n.mjs can load it with Node.
//
// To add a language: create lib/strings/xx.js, import it here, and add it to
// LANGS and MESSAGES. Any key a language doesn't have shows in English.
import en from "./strings/en.js";
import sw from "./strings/sw.js";
import lg from "./strings/lg.js";

export const LANGS = { en: "English", sw: "Kiswahili", lg: "Luganda" };
export const MESSAGES = { en, sw, lg };

/** The text for `key` in `lang` (English if missing), with {name} placeholders filled from `vars`. */
export function translate(lang, key, vars) {
  let s = (MESSAGES[lang] && MESSAGES[lang][key]) || MESSAGES.en[key] || key;
  if (vars)
    Object.keys(vars).forEach((k) => {
      s = s.split("{" + k + "}").join(String(vars[k]));
    });
  return s;
}

"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "./strings/en";
import sw from "./strings/sw";
import lg from "./strings/lg";

// To add a language: create lib/strings/xx.js, import it here, and add it to LANGS and STRINGS.
// Any key a language doesn't have automatically shows in English.
export const LANGS = { en: "English", sw: "Kiswahili", lg: "Luganda" };
const STRINGS = { en, sw, lg };

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    try { const s = localStorage.getItem("ww_lang"); if (s && LANGS[s]) setLangState(s); } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l) => { setLangState(l); try { localStorage.setItem("ww_lang", l); } catch {} }, []);
  const t = useCallback((key, vars) => {
    let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.split("{" + k + "}").join(String(vars[k])); });
    return s;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);

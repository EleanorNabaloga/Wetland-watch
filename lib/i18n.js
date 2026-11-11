"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { LANGS, translate } from "./messages";

// The strings and languages live in lib/messages.js.
export { LANGS };

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    try {
      const s = localStorage.getItem("ww_lang");
      if (s && LANGS[s]) setLangState(s);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem("ww_lang", l);
    } catch {}
  }, []);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);

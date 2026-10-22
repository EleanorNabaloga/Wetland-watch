"use client";
import { LANGS, useT } from "@/lib/i18n";

export default function LanguagePicker() {
  const { lang, setLang, t } = useT();
  return (
    <select aria-label={t("language")} value={lang} onChange={(e) => setLang(e.target.value)}
      style={{ width: "auto", padding: ".35rem .7rem", borderRadius: 999, border: "1.5px solid var(--line)", background: "var(--card)" }}>
      {Object.entries(LANGS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );
}
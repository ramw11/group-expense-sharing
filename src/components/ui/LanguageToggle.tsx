import type { Language } from "../../domain/models";

interface LanguageToggleProps { language: Language; onChange(language: Language): void; dark?: boolean; }

export function LanguageToggle({ language, onChange, dark = false }: LanguageToggleProps) {
  return <div className={`language-toggle ${dark ? "dark" : ""}`} aria-label="Language">
    <button className={language === "he" ? "active" : ""} onClick={() => onChange("he")}>עב</button>
    <button className={language === "en" ? "active" : ""} onClick={() => onChange("en")}>EN</button>
  </div>;
}

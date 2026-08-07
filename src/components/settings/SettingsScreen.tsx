import { ArrowLeft, BadgeDollarSign, Baby, Scale, SlidersHorizontal } from "lucide-react";
import type { Language, Settings } from "../../domain/models";
import { translate } from "../../i18n";
import { LanguageToggle } from "../ui/LanguageToggle";

interface SettingsScreenProps { settings: Settings; language: Language; onLanguageChange(language: Language): void; onChange(settings: Settings): void; onBack(): void; }

export function SettingsScreen({ settings, language, onLanguageChange, onChange, onBack }: SettingsScreenProps) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <div className="page-shell settings-page">
    <div className="screen-tools"><button className="back-button" onClick={onBack}><ArrowLeft size={19} /> {t("back")}</button><LanguageToggle language={language} onChange={onLanguageChange} /></div>
    <header><p className="eyebrow">{t("makeYours")}</p><h1>{t("settingsTitleA")}<br /><span>{t("settingsTitleB")}</span></h1><p>{t("settingsCopy")}</p></header>
    <section className="settings-grid">
      <article className="setting-card accent-lime"><div className="setting-icon"><BadgeDollarSign /></div><div><h2>{t("money")}</h2><p>{t("moneyCopy")}</p></div><label><span>{t("currency")}</span><select value={settings.currency} onChange={(event) => update("currency", event.target.value)}><option value="ILS">ILS — ₪</option><option value="USD">USD — $</option><option value="EUR">EUR — €</option><option value="GBP">GBP — £</option></select></label><label><span>{t("rounding")}</span><select value={settings.roundingMode} onChange={(event) => update("roundingMode", event.target.value as Settings["roundingMode"])}><option value="none">{t("exactCents")}</option><option value="nearest-0.5">{t("nearestHalf")}</option><option value="nearest-1">{t("nearestWhole")}</option></select></label></article>
      <article className="setting-card accent-pink"><div className="setting-icon"><Scale /></div><div><h2>{t("participantWeight")}</h2><p>{t("weightCopy")}</p></div><div className="segmented"><button className={settings.weightMode === "automatic" ? "active" : ""} onClick={() => update("weightMode", "automatic")}>{t("automatic")}</button><button className={settings.weightMode === "manual" ? "active" : ""} onClick={() => update("weightMode", "manual")}>{t("manual")}</button></div>{settings.weightMode === "automatic" && <div className="setting-pair"><label><span>{t("childUnder")}</span><input type="number" min="1" max="21" value={settings.childAgeThreshold} onChange={(event) => update("childAgeThreshold", Number(event.target.value))} /></label><label><span>{t("childWeight")}</span><input type="number" min="0" max="1" step="0.1" value={settings.childWeight} onChange={(event) => update("childWeight", Number(event.target.value))} /></label></div>}<div className="setting-tip"><Baby size={19} /> {t("ageTip")}</div></article>
      <article className="setting-card accent-violet wide"><div className="setting-icon"><SlidersHorizontal /></div><div><h2>{t("reportFooter")}</h2><p>{t("footerCopy")}</p></div><label><span>{t("footerText")}</span><textarea rows={3} value={settings.reportFooter} onChange={(event) => update("reportFooter", event.target.value)} placeholder={t("thanks")} /></label></article>
    </section>
  </div>;
}

import { ArrowLeft, BadgeDollarSign, Baby, Scale, SlidersHorizontal } from "lucide-react";
import type { Settings } from "../../domain/models";

interface SettingsScreenProps {
  settings: Settings;
  onChange(settings: Settings): void;
  onBack(): void;
}

export function SettingsScreen({ settings, onChange, onBack }: SettingsScreenProps) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  return <div className="page-shell settings-page">
    <button className="back-button" onClick={onBack}><ArrowLeft size={19} /> Back</button>
    <header><p className="eyebrow">Make it yours</p><h1>Settings,<br /><span>not clutter.</span></h1><p>One set of defaults, used instantly across every group.</p></header>
    <section className="settings-grid">
      <article className="setting-card accent-lime"><div className="setting-icon"><BadgeDollarSign /></div><div><h2>Money</h2><p>Choose the currency and how final shares are rounded.</p></div><label><span>Currency</span><select value={settings.currency} onChange={(event) => update("currency", event.target.value)}><option value="ILS">ILS — Israeli shekel</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British pound</option></select></label><label><span>Rounding</span><select value={settings.roundingMode} onChange={(event) => update("roundingMode", event.target.value as Settings["roundingMode"])}><option value="none">Exact cents</option><option value="nearest-0.5">Nearest 0.50</option><option value="nearest-1">Nearest whole unit</option></select></label></article>
      <article className="setting-card accent-pink"><div className="setting-icon"><Scale /></div><div><h2>Participant weight</h2><p>Use ages automatically, or maintain a weight per member.</p></div><div className="segmented"><button className={settings.weightMode === "automatic" ? "active" : ""} onClick={() => update("weightMode", "automatic")}>Automatic</button><button className={settings.weightMode === "manual" ? "active" : ""} onClick={() => update("weightMode", "manual")}>Manual</button></div>{settings.weightMode === "automatic" && <div className="setting-pair"><label><span>Child under age</span><input type="number" min="1" max="21" value={settings.childAgeThreshold} onChange={(event) => update("childAgeThreshold", Number(event.target.value))} /></label><label><span>Child weight</span><input type="number" min="0" max="1" step="0.1" value={settings.childWeight} onChange={(event) => update("childWeight", Number(event.target.value))} /></label></div>}<div className="setting-tip"><Baby size={19} /> Ages are calculated on each gathering date.</div></article>
      <article className="setting-card accent-violet wide"><div className="setting-icon"><SlidersHorizontal /></div><div><h2>Report footer</h2><p>This line appears at the end of every copied settlement report.</p></div><label><span>Footer text</span><textarea rows={3} value={settings.reportFooter} onChange={(event) => update("reportFooter", event.target.value)} placeholder="Thanks everyone!" /></label></article>
    </section>
  </div>;
}

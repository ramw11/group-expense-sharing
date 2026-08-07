import { ArrowUpRight, CalendarDays, Cloud, CloudAlert, FolderHeart, Link2, LoaderCircle, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BillingUnit, GatheringDraft, Language, SharedGroupConnection } from "../../domain/models";
import { translate } from "../../i18n";
import { IconButton } from "../ui/IconButton";
import { LanguageToggle } from "../ui/LanguageToggle";

interface GroupHomeProps {
  events: GatheringDraft[];
  families: BillingUnit[];
  sharedGroups: SharedGroupConnection[];
  cloudStatus: "idle" | "syncing" | "synced" | "error";
  cloudMessage: string;
  language: Language;
  onLanguageChange(language: Language): void;
  onCreate(name: string): void;
  onUpdate(id: string, name: string): void;
  onDelete(id: string): void;
  onStart(id: string): void;
  onShare(groupId: string): void;
  onFamilies(): void;
  onSettings(): void;
}

export function GroupHome({ events, families, sharedGroups, cloudStatus, cloudMessage, language, onLanguageChange, onCreate, onUpdate, onDelete, onStart, onShare, onFamilies, onSettings }: GroupHomeProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const submit = () => {
    const next = name.trim();
    if (!next) return;
    if (editingId) onUpdate(editingId, next); else onCreate(next);
    setName(""); setEditingId(null);
  };

  return <div className="page-shell">
    <div className="home-tools"><LanguageToggle language={language} onChange={onLanguageChange} /><button className="family-trigger" onClick={onFamilies}><FolderHeart size={18} /> {t("familyRepository")} <b>{families.length}</b></button><button className="settings-trigger" onClick={onSettings}><Settings size={18} /> {t("settings")}</button></div>
    <header className="hero-grid"><div><p className="eyebrow">{t("homeEyebrow")}</p><h1>{t("homeTitleA")}<br /><span>{t("homeTitleB")}</span></h1><p className="hero-copy">{t("homeCopyIndependent")}</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit-card orbit-one">₪</div><div className="orbit-card orbit-two"><CalendarDays size={31} /></div><div className="orbit-dot" /></div></header>
    {(cloudStatus !== "idle" || cloudMessage) && <div className={`cloud-banner ${cloudStatus}`}>{cloudStatus === "syncing" ? <LoaderCircle className="spin" size={18} /> : cloudStatus === "error" ? <CloudAlert size={18} /> : <Cloud size={18} />}<strong>{cloudStatus === "syncing" ? t("syncing") : cloudStatus === "error" ? t("syncError") : t("synced")}</strong>{cloudMessage && <span>{cloudMessage}</span>}</div>}

    <section className="panel create-strip" aria-labelledby="events-title"><div><p className="section-kicker">{t("newEvent")}</p><h2 id="events-title">{editingId ? t("editEvent") : t("nameEventFirst")}</h2></div><div className="inline-form"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={t("eventNamePlaceholder")} /><button className="primary-button" onClick={submit}><Plus size={19} /> {editingId ? t("save") : t("createAndChoose")}</button></div></section>

    <section className="group-grid" aria-label={t("circles")}>
      {events.length === 0 ? <div className="empty-card"><div className="empty-icon"><CalendarDays size={28} /></div><h3>{t("firstGroup")}</h3><p>{t("firstEventFlow")}</p></div> : events.map((event, index) => {
        const isShared = sharedGroups.some((item) => item.groupId === event.groupId);
        const familyNames = event.familyIds.map((familyId) => families.find((family) => family.id === familyId)?.name).filter(Boolean);
        return <article className={`group-card tone-${index % 3}`} key={event.id}>
          <div className="group-card-top"><span className="group-number">{String(index + 1).padStart(2, "0")}</span><div className="card-actions"><IconButton label={`${t("rename")} ${event.name}`} onClick={() => { setEditingId(event.id); setName(event.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={17} /></IconButton><IconButton label={`${t("delete")} ${event.name}`} onClick={() => onDelete(event.id)}><Trash2 size={17} /></IconButton></div></div>
          <button className="group-open" onClick={() => onStart(event.id)}><span>{event.name}<small className="event-family-label">{familyNames.length ? familyNames.join(" · ") : t("chooseParticipants")}</small><small className="event-date-label">{event.date}</small></span><ArrowUpRight size={28} /></button>
          <div className="group-choices two-actions"><button className="event-button" onClick={() => onStart(event.id)}>{t("continueEvent")} <ArrowUpRight size={18} /></button><button className={`share-button ${isShared ? "shared" : ""}`} onClick={() => onShare(event.groupId)}>{isShared ? <Cloud size={17} /> : <Link2 size={17} />} {isShared ? t("sharedGroup") : t("shareGroup")}</button></div>
        </article>;
      })}
    </section>
  </div>;
}

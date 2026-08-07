import { ArrowUpRight, CalendarDays, Cloud, CloudAlert, FolderHeart, Link2, LoaderCircle, Pencil, Plus, Settings, SlidersHorizontal, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import type { GatheringDraft, Group, Language, SharedGroupConnection } from "../../domain/models";
import { translate } from "../../i18n";
import { IconButton } from "../ui/IconButton";
import { LanguageToggle } from "../ui/LanguageToggle";

interface GroupHomeProps {
  groups: Group[];
  events: GatheringDraft[];
  sharedGroups: SharedGroupConnection[];
  cloudStatus: "idle" | "syncing" | "synced" | "error";
  cloudMessage: string;
  language: Language;
  onLanguageChange(language: Language): void;
  onCreate(name: string, groupId: string): void;
  onUpdate(id: string, name: string, groupId: string): void;
  onDelete(id: string): void;
  onStart(id: string): void;
  onManageFamily(groupId: string, eventId: string): void;
  onShare(groupId: string): void;
  onFamilies(): void;
  onSettings(): void;
}

export function GroupHome({ groups, events, sharedGroups, cloudStatus, cloudMessage, language, onLanguageChange, onCreate, onUpdate, onDelete, onStart, onManageFamily, onShare, onFamilies, onSettings }: GroupHomeProps) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const effectiveGroupId = groups.some((group) => group.id === groupId) ? groupId : (groups[0]?.id ?? "");

  const submit = () => {
    const next = name.trim();
    if (!next || !effectiveGroupId) return;
    if (editingId) onUpdate(editingId, next, effectiveGroupId);
    else onCreate(next, effectiveGroupId);
    setName("");
    setEditingId(null);
  };

  const beginEdit = (event: GatheringDraft) => {
    setEditingId(event.id);
    setName(event.name);
    setGroupId(event.groupId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="page-shell">
    <div className="home-tools"><LanguageToggle language={language} onChange={onLanguageChange} /><button className="family-trigger" onClick={onFamilies}><FolderHeart size={18} /> {t("manageFamilies")}</button><button className="settings-trigger" onClick={onSettings}><Settings size={18} /> {t("settings")}</button></div>
    <header className="hero-grid"><div><p className="eyebrow">{t("homeEyebrow")}</p><h1>{t("homeTitleA")}<br /><span>{t("homeTitleB")}</span></h1><p className="hero-copy">{t("homeCopy")}</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit-card orbit-one">₪</div><div className="orbit-card orbit-two"><CalendarDays size={31} /></div><div className="orbit-dot" /></div></header>
    {(cloudStatus !== "idle" || cloudMessage) && <div className={`cloud-banner ${cloudStatus}`}>{cloudStatus === "syncing" ? <LoaderCircle className="spin" size={18} /> : cloudStatus === "error" ? <CloudAlert size={18} /> : <Cloud size={18} />}<strong>{cloudStatus === "syncing" ? t("syncing") : cloudStatus === "error" ? t("syncError") : t("synced")}</strong>{cloudMessage && <span>{cloudMessage}</span>}</div>}

    <section className="panel create-strip event-create-strip" aria-labelledby="events-title">
      <div><p className="section-kicker">{t("eventDetails")}</p><h2 id="events-title">{editingId ? t("editEvent") : t("createTitle")}</h2></div>
      {groups.length ? <div className="event-form">
        <label><span>{t("eventName")}</span><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={t("eventNamePlaceholder")} /></label>
        <label><span>{t("chooseFamily")}</span><select value={effectiveGroupId} onChange={(event) => setGroupId(event.target.value)}>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
        <button className="primary-button" onClick={submit}><Plus size={19} /> {editingId ? t("save") : t("create")}</button>
      </div> : <button className="primary-button" onClick={onFamilies}><UsersRound size={19} /> {t("createFamilyFirst")}</button>}
    </section>

    <section className="group-grid" aria-label={t("circles")}>
      {events.length === 0 ? <div className="empty-card"><div className="empty-icon"><CalendarDays size={28} /></div><h3>{t("firstGroup")}</h3><p>{t("firstGroupCopy")}</p></div> : events.map((event, index) => {
        const group = groups.find((item) => item.id === event.groupId);
        const isShared = sharedGroups.some((item) => item.groupId === event.groupId);
        return <article className={`group-card tone-${index % 3}`} key={event.id}>
          <div className="group-card-top"><span className="group-number">{String(index + 1).padStart(2, "0")}</span><div className="card-actions"><IconButton label={`${t("rename")} ${event.name}`} onClick={() => beginEdit(event)}><Pencil size={17} /></IconButton><IconButton label={`${t("delete")} ${event.name}`} onClick={() => onDelete(event.id)}><Trash2 size={17} /></IconButton></div></div>
          <button className="group-open" onClick={() => onStart(event.id)}><span>{event.name}<small className="event-family-label">{group?.name ?? t("missingFamily")}</small><small className="event-date-label">{event.date}</small></span><ArrowUpRight size={28} /></button>
          <div className="group-choices"><button className="event-button" onClick={() => onStart(event.id)}>{t("continueEvent")} <ArrowUpRight size={18} /></button>{group && <button className="manage-button" onClick={() => onManageFamily(group.id, event.id)}><SlidersHorizontal size={17} /> {t("editFamily")}</button>}{group && <button className={`share-button ${isShared ? "shared" : ""}`} onClick={() => onShare(group.id)}>{isShared ? <Cloud size={17} /> : <Link2 size={17} />} {isShared ? t("sharedGroup") : t("shareGroup")}</button>}</div>
        </article>;
      })}
    </section>
  </div>;
}

import { ArrowUpRight, Pencil, Plus, Settings, SlidersHorizontal, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import type { GatheringDraft, Group, Language } from "../../domain/models";
import { translate } from "../../i18n";
import { IconButton } from "../ui/IconButton";
import { LanguageToggle } from "../ui/LanguageToggle";

interface GroupHomeProps {
  groups: Group[]; drafts: GatheringDraft[]; language: Language; onLanguageChange(language: Language): void;
  onCreate(name: string): void; onRename(id: string, name: string): void; onDelete(id: string): void;
  onStart(id: string): void; onManage(id: string): void; onSettings(): void;
}

export function GroupHome({ groups, drafts, language, onLanguageChange, onCreate, onRename, onDelete, onStart, onManage, onSettings }: GroupHomeProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const submit = () => {
    const next = name.trim(); if (!next) return;
    if (editingId) onRename(editingId, next); else onCreate(next);
    setName(""); setEditingId(null);
  };

  return <div className="page-shell">
    <div className="home-tools"><LanguageToggle language={language} onChange={onLanguageChange} /><button className="settings-trigger" onClick={onSettings}><Settings size={18} /> {t("settings")}</button></div>
    <header className="hero-grid"><div><p className="eyebrow">{t("homeEyebrow")}</p><h1>{t("homeTitleA")}<br /><span>{t("homeTitleB")}</span></h1><p className="hero-copy">{t("homeCopy")}</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit-card orbit-one">₪</div><div className="orbit-card orbit-two"><UsersRound size={31} /></div><div className="orbit-dot" /></div></header>

    <section className="panel create-strip" aria-labelledby="groups-title"><div><p className="section-kicker">{t("circles")}</p><h2 id="groups-title">{editingId ? t("renameTitle") : t("createTitle")}</h2></div><div className="inline-form"><label className="sr-only" htmlFor="group-name">{t("createTitle")}</label><input id="group-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={t("groupPlaceholder")} /><button className="primary-button" onClick={submit}><Plus size={19} /> {editingId ? t("save") : t("create")}</button></div></section>

    <section className="group-grid" aria-label={t("circles")}>
      {groups.length === 0 ? <div className="empty-card"><div className="empty-icon"><UsersRound size={28} /></div><h3>{t("firstGroup")}</h3><p>{t("firstGroupCopy")}</p></div> : groups.map((group, index) => { const draft = drafts.find((item) => item.groupId === group.id); const hasDraft = Boolean(draft); return <article className={`group-card tone-${index % 3}`} key={group.id}>
        <div className="group-card-top"><span className="group-number">{String(index + 1).padStart(2, "0")}</span><div className="card-actions"><IconButton label={`${t("rename")} ${group.name}`} onClick={() => { setEditingId(group.id); setName(group.name); }}><Pencil size={17} /></IconButton><IconButton label={`${t("delete")} ${group.name}`} onClick={() => onDelete(group.id)}><Trash2 size={17} /></IconButton></div></div>
        <button className="group-open" onClick={() => onStart(group.id)}><span>{group.name}{hasDraft && <small>{draft?.name || t("draftLabel")}</small>}</span><ArrowUpRight size={28} /></button>
        <div className="group-choices"><button className="event-button" onClick={() => onStart(group.id)}>{hasDraft ? t("continueEvent") : t("startEvent")} <ArrowUpRight size={18} /></button><button className="manage-button" onClick={() => onManage(group.id)}><SlidersHorizontal size={17} /> {t("manageGroup")}</button></div>
      </article>; })}
    </section>
  </div>;
}

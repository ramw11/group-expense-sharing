import { ArrowLeft, Pencil, Plus, Settings2, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import type { BillingUnit, Group, Language, Member } from "../../domain/models";
import { translate } from "../../i18n";
import { IconButton } from "../ui/IconButton";

interface FamilyHomeProps {
  groups: Group[];
  units: BillingUnit[];
  members: Member[];
  language: Language;
  onBack(): void;
  onCreate(name: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onManage(id: string): void;
}

export function FamilyHome({ groups, units, members, language, onBack, onCreate, onRename, onDelete, onManage }: FamilyHomeProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const submit = () => {
    const next = name.trim();
    if (!next) return;
    if (editingId) onRename(editingId, next); else onCreate(next);
    setName("");
    setEditingId(null);
  };

  return <div className="page-shell family-page">
    <div className="screen-tools"><button className="back-button" onClick={onBack}><ArrowLeft size={19} /> {t("allEvents")}</button></div>
    <header className="family-heading"><p className="eyebrow">{t("familyLibrary")}</p><h1>{t("familiesTitle")}</h1><p>{t("familiesCopy")}</p></header>
    <section className="panel create-strip"><div><p className="section-kicker">{t("familyDetails")}</p><h2>{editingId ? t("renameFamily") : t("createFamily")}</h2></div><div className="inline-form"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={t("familyNamePlaceholder")} /><button className="primary-button" onClick={submit}><Plus size={19} /> {editingId ? t("save") : t("create")}</button></div></section>
    <section className="family-grid">
      {groups.map((group, index) => {
        const familyUnits = units.filter((unit) => unit.groupId === group.id);
        const unitIds = new Set(familyUnits.map((unit) => unit.id));
        const memberCount = members.filter((member) => unitIds.has(member.billingUnitId)).length;
        return <article className={`family-card tone-${index % 3}`} key={group.id}>
          <div className="group-card-top"><span className="group-number">{String(index + 1).padStart(2, "0")}</span><div className="card-actions"><IconButton label={`${t("rename")} ${group.name}`} onClick={() => { setEditingId(group.id); setName(group.name); }}><Pencil size={17} /></IconButton><IconButton label={`${t("delete")} ${group.name}`} onClick={() => onDelete(group.id)}><Trash2 size={17} /></IconButton></div></div>
          <div className="family-card-main"><UsersRound size={30} /><h2>{group.name}</h2><p>{familyUnits.length} {t("billingUnits")} · {memberCount} {t("members")}</p></div>
          <button className="family-manage-button" onClick={() => onManage(group.id)}><Settings2 size={18} /> {t("configureFamily")}</button>
        </article>;
      })}
    </section>
  </div>;
}

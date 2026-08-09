import { ArrowLeft, CalendarDays, Link2, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { useState } from "react";
import type { BillingUnit, Event, Group, Language, Member } from "../../domain/models";
import { translate } from "../../i18n";
import { IconButton } from "../ui/IconButton";
import { LanguageToggle } from "../ui/LanguageToggle";

interface GroupWorkspaceProps {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  events: Event[];
  language: Language;
  onLanguageChange(language: Language): void;
  onBack(): void;
  onAddUnit(name: string): void;
  onRenameUnit(id: string, name: string): void;
  onDeleteUnit(id: string): void;
  onAddMember(unitId: string, member: Omit<Member, "id" | "billingUnitId" | "order">): void;
  onUpdateMember(id: string, member: Partial<Member>): void;
  onDeleteMember(id: string): void;
  onAssignFamily(familyId: string, eventId: string): void;
  onCreateEventWithFamily(familyId: string, eventName: string): void;
}

const initialMemberForm = { name: "", birthDate: "", manualWeight: "", notes: "", active: true };

export function GroupWorkspace({ units, members, events, language, onLanguageChange, onBack, onAddUnit, onRenameUnit, onDeleteUnit, onAddMember, onUpdateMember, onDeleteMember, onAssignFamily, onCreateEventWithFamily }: GroupWorkspaceProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [targetEventId, setTargetEventId] = useState(events[0]?.id ?? "");
  const [newEventName, setNewEventName] = useState("");
  const sortedUnits = [...units].sort((a, b) => a.order - b.order);
  const effectiveUnitId = units.some((unit) => unit.id === selectedUnitId) ? selectedUnitId : null;
  const selectedUnit = units.find((unit) => unit.id === effectiveUnitId);
  const targetEvent = events.find((event) => event.id === targetEventId);
  const alreadyLinked = Boolean(selectedUnit && targetEvent?.familyIds.includes(selectedUnit.id));
  const unitMembers = members.filter((member) => member.billingUnitId === effectiveUnitId).sort((a, b) => a.order - b.order);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const submitUnit = () => {
    const next = name.trim();
    if (!next) return;
    if (editingId) onRenameUnit(editingId, next); else onAddUnit(next);
    setName(""); setEditingId(null);
  };
  const submitMember = () => {
    const memberName = memberForm.name.trim();
    if (!memberName || !effectiveUnitId) return;
    const details = { name: memberName, birthDate: memberForm.birthDate || undefined, manualWeight: memberForm.manualWeight ? Number(memberForm.manualWeight) : undefined, notes: memberForm.notes.trim() || undefined, active: memberForm.active };
    if (editingMemberId) onUpdateMember(editingMemberId, details); else onAddMember(effectiveUnitId, details);
    setMemberForm(initialMemberForm); setEditingMemberId(null);
  };
  const editMember = (member: Member) => {
    setEditingMemberId(member.id);
    setMemberForm({ name: member.name, birthDate: member.birthDate ?? "", manualWeight: member.manualWeight?.toString() ?? "", notes: member.notes ?? "", active: member.active });
  };

  return <div className="page-shell workspace">
    <div className="screen-tools"><button className="back-button" onClick={onBack}><ArrowLeft size={19} /> {t("allEvents")}</button><LanguageToggle language={language} onChange={onLanguageChange} /></div>
    <header className="workspace-heading"><div><p className="eyebrow">{t("familyRepository")}</p><h1>{t("familiesTitle")}</h1><p className="workspace-copy">{t("familiesCopyClear")}</p></div><div className="stat-stamp"><strong>{units.length}</strong><span>{t("families")}</span></div></header>

    <div className="workspace-columns">
      <section className="panel workspace-panel">
        <div className="panel-title-row"><div><p className="section-kicker">{t("savedFamilies")}</p><h2>{t("families")}</h2></div></div>
        <div className="inline-form unit-form"><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitUnit()} placeholder={t("familyNamePlaceholder")} /><button className="primary-button" onClick={submitUnit}><Plus size={19} /> {editingId ? t("save") : t("addFamily")}</button></div>
        <div className="unit-list">
          {sortedUnits.length === 0 ? <div className="small-empty">{t("noFamilies")}</div> : sortedUnits.map((unit, index) => {
            const memberCount = members.filter((member) => member.billingUnitId === unit.id).length;
            const linkedCount = events.filter((event) => event.familyIds.includes(unit.id)).length;
            return <article className={`unit-row ${effectiveUnitId === unit.id ? "selected" : ""}`} key={unit.id}>
              <span className="unit-index">{index + 1}</span><div className="unit-mark"><Users size={20} /></div>
              <button className="unit-name" aria-expanded={effectiveUnitId === unit.id} onClick={() => { setSelectedUnitId(effectiveUnitId === unit.id ? null : unit.id); setEditingMemberId(null); setMemberForm(initialMemberForm); }}><strong>{unit.name}</strong><span>{memberCount} {memberCount === 1 ? t("member") : t("members")} · {linkedCount} {t("eventsLabel")}</span></button>
              <div className="card-actions"><IconButton label={`${t("rename")} ${unit.name}`} onClick={() => { setEditingId(unit.id); setName(unit.name); }}><Pencil size={17} /></IconButton>{linkedCount === 0 && <IconButton label={`${t("delete")} ${unit.name}`} onClick={() => onDeleteUnit(unit.id)}><Trash2 size={17} /></IconButton>}</div>
            </article>;
          })}
        </div>
        {selectedUnit && <div className="assignment-panel"><div><p className="section-kicker">{t("assignFamily")}</p><h3>{selectedUnit.name}</h3></div>{events.length > 0 && <div className="assignment-row"><select value={targetEventId} onChange={(event) => setTargetEventId(event.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><button disabled={alreadyLinked} onClick={() => targetEventId && onAssignFamily(selectedUnit.id, targetEventId)}><Link2 size={17} /> {alreadyLinked ? t("alreadyLinked") : t("addToExistingEvent")}</button></div>}<div className="assignment-row"><input value={newEventName} onChange={(event) => setNewEventName(event.target.value)} placeholder={t("newEventName")} /><button onClick={() => { const next = newEventName.trim(); if (!next) return; onCreateEventWithFamily(selectedUnit.id, next); setNewEventName(""); }}><Plus size={17} /> {t("createEventWithFamily")}</button></div></div>}
      </section>

      {selectedUnit && <section className="panel member-panel">
        <div className="member-panel-head"><div><p className="section-kicker">{t("familyMembers")}</p><h2>{selectedUnit?.name ?? t("selectFamily")}</h2></div><div className="member-count">{unitMembers.length}</div></div>
        {selectedUnit && <>
          <div className="member-form-grid">
            <input aria-label={t("memberName")} value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} placeholder={t("memberName")} />
            <label className="date-input"><CalendarDays size={17} /><input aria-label={t("birthDate")} type="date" value={memberForm.birthDate} onChange={(event) => setMemberForm({ ...memberForm, birthDate: event.target.value })} /></label>
            <input aria-label={t("manualWeight")} type="number" min="0" step="0.1" value={memberForm.manualWeight} onChange={(event) => setMemberForm({ ...memberForm, manualWeight: event.target.value })} placeholder={t("manualWeight")} />
            <input aria-label={t("notes")} value={memberForm.notes} onChange={(event) => setMemberForm({ ...memberForm, notes: event.target.value })} placeholder={t("notes")} />
            <label className="check-label"><input type="checkbox" checked={memberForm.active} onChange={(event) => setMemberForm({ ...memberForm, active: event.target.checked })} /> {t("active")}</label>
            <button className="primary-button" onClick={submitMember}><Plus size={19} /> {editingMemberId ? t("saveMember") : t("addMember")}</button>
          </div>
          <div className="member-list">{unitMembers.length === 0 ? <div className="small-empty">{t("noMembers")}</div> : unitMembers.map((member) => <article className={`member-chip ${!member.active ? "inactive" : ""}`} key={member.id}><div className="avatar"><UserRound size={17} /></div><div><strong>{member.name}</strong><span>{member.birthDate ? `${t("born")} ${member.birthDate}` : member.manualWeight ? `${t("weight")} ${member.manualWeight}` : t("defaultWeight")}</span></div><div className="card-actions"><IconButton label={`${t("rename")} ${member.name}`} onClick={() => editMember(member)}><Pencil size={16} /></IconButton><IconButton label={`${t("delete")} ${member.name}`} onClick={() => onDeleteMember(member.id)}><Trash2 size={16} /></IconButton></div></article>)}</div>
        </>}
      </section>}
    </div>
  </div>;
}

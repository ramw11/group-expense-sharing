import { ArrowLeft, ArrowRight, CalendarDays, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { useState } from "react";
import type { BillingUnit, Group, Member } from "../../domain/models";
import { IconButton } from "../ui/IconButton";

interface GroupWorkspaceProps {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  onBack(): void;
  onAddUnit(name: string): void;
  onRenameUnit(id: string, name: string): void;
  onDeleteUnit(id: string): void;
  onAddMember(unitId: string, member: Omit<Member, "id" | "billingUnitId" | "order">): void;
  onUpdateMember(id: string, member: Partial<Member>): void;
  onDeleteMember(id: string): void;
  onStartGathering(): void;
}

const initialMemberForm = { name: "", birthDate: "", manualWeight: "", notes: "", active: true };

export function GroupWorkspace({ group, units, members, onBack, onAddUnit, onRenameUnit, onDeleteUnit, onAddMember, onUpdateMember, onDeleteMember, onStartGathering }: GroupWorkspaceProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(units[0]?.id ?? null);
  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const sortedUnits = [...units].sort((a, b) => a.order - b.order);
  const effectiveUnitId = units.some((unit) => unit.id === selectedUnitId) ? selectedUnitId : (units[0]?.id ?? null);
  const selectedUnit = units.find((unit) => unit.id === effectiveUnitId);
  const unitMembers = members.filter((member) => member.billingUnitId === effectiveUnitId).sort((a, b) => a.order - b.order);

  const submitUnit = () => {
    const next = name.trim();
    if (!next) return;
    if (editingId) onRenameUnit(editingId, next); else onAddUnit(next);
    setName(""); setEditingId(null);
  };

  const submitMember = () => {
    const memberName = memberForm.name.trim();
    if (!memberName || !effectiveUnitId) return;
    const details = {
      name: memberName,
      birthDate: memberForm.birthDate || undefined,
      manualWeight: memberForm.manualWeight ? Number(memberForm.manualWeight) : undefined,
      notes: memberForm.notes.trim() || undefined,
      active: memberForm.active,
    };
    if (editingMemberId) onUpdateMember(editingMemberId, details); else onAddMember(effectiveUnitId, details);
    setMemberForm(initialMemberForm); setEditingMemberId(null);
  };

  const editMember = (member: Member) => {
    setEditingMemberId(member.id);
    setMemberForm({ name: member.name, birthDate: member.birthDate ?? "", manualWeight: member.manualWeight?.toString() ?? "", notes: member.notes ?? "", active: member.active });
  };

  return (
    <div className="page-shell workspace">
      <button className="back-button" onClick={onBack}><ArrowLeft size={19} /> All groups</button>
      <header className="workspace-heading"><div><p className="eyebrow">Group setup</p><h1>{group.name}</h1></div><div className="workspace-actions"><div className="stat-stamp"><strong>{members.length}</strong><span>people<br />ready</span></div><button className="start-button" onClick={onStartGathering}>Start gathering <ArrowRight size={20} /></button></div></header>

      <div className="workspace-columns">
        <section className="panel workspace-panel">
          <div className="panel-title-row"><div><p className="section-kicker">Who pays together?</p><h2>Billing units</h2></div></div>
          <div className="inline-form unit-form"><label className="sr-only" htmlFor="unit-name">Billing unit name</label><input id="unit-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitUnit()} placeholder="e.g. The Cohen family" /><button className="primary-button" onClick={submitUnit}><Plus size={19} /> {editingId ? "Save" : "Add"}</button></div>
          <div className="unit-list">
            {sortedUnits.length === 0 ? <div className="small-empty">Add the first person or household that pays together.</div> : sortedUnits.map((unit, index) => {
              const memberCount = members.filter((member) => member.billingUnitId === unit.id).length;
              return <article className={`unit-row ${effectiveUnitId === unit.id ? "selected" : ""}`} key={unit.id}>
                <span className="unit-index">{index + 1}</span><div className="unit-mark"><Users size={20} /></div>
                <button className="unit-name" onClick={() => { setSelectedUnitId(unit.id); setEditingMemberId(null); setMemberForm(initialMemberForm); }}><strong>{unit.name}</strong><span>{memberCount} {memberCount === 1 ? "member" : "members"}</span></button>
                <div className="card-actions"><IconButton label={`Rename ${unit.name}`} onClick={() => { setEditingId(unit.id); setName(unit.name); }}><Pencil size={17} /></IconButton><IconButton label={`Delete ${unit.name}`} onClick={() => onDeleteUnit(unit.id)}><Trash2 size={17} /></IconButton><IconButton label={`Manage ${unit.name}`} onClick={() => setSelectedUnitId(unit.id)}><ArrowRight size={18} /></IconButton></div>
              </article>;
            })}
          </div>
        </section>

        <section className="panel member-panel">
          <div className="member-panel-head"><div><p className="section-kicker">People</p><h2>{selectedUnit?.name ?? "Select a unit"}</h2></div><div className="member-count">{unitMembers.length}</div></div>
          {selectedUnit && <>
            <div className="member-form-grid">
              <input aria-label="Member name" value={memberForm.name} onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })} placeholder="Member name" />
              <label className="date-input"><CalendarDays size={17} /><input aria-label="Birth date" type="date" value={memberForm.birthDate} onChange={(event) => setMemberForm({ ...memberForm, birthDate: event.target.value })} /></label>
              <input aria-label="Manual weight" type="number" min="0" step="0.1" value={memberForm.manualWeight} onChange={(event) => setMemberForm({ ...memberForm, manualWeight: event.target.value })} placeholder="Manual weight" />
              <input aria-label="Notes" value={memberForm.notes} onChange={(event) => setMemberForm({ ...memberForm, notes: event.target.value })} placeholder="Notes (optional)" />
              <label className="check-label"><input type="checkbox" checked={memberForm.active} onChange={(event) => setMemberForm({ ...memberForm, active: event.target.checked })} /> Active</label>
              <button className="primary-button" onClick={submitMember}><Plus size={19} /> {editingMemberId ? "Save member" : "Add member"}</button>
            </div>
            <div className="member-list">{unitMembers.length === 0 ? <div className="small-empty">No members yet.</div> : unitMembers.map((member) => <article className={`member-chip ${!member.active ? "inactive" : ""}`} key={member.id}><div className="avatar"><UserRound size={17} /></div><div><strong>{member.name}</strong><span>{member.birthDate ? `Born ${member.birthDate}` : member.manualWeight ? `Weight ${member.manualWeight}` : "Default weight"}</span></div><div className="card-actions"><IconButton label={`Edit ${member.name}`} onClick={() => editMember(member)}><Pencil size={16} /></IconButton><IconButton label={`Delete ${member.name}`} onClick={() => onDeleteMember(member.id)}><Trash2 size={16} /></IconButton></div></article>)}</div>
          </>}
        </section>
      </div>
    </div>
  );
}

import { ArrowUpRight, Pencil, Plus, Settings, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import type { Group } from "../../domain/models";
import { IconButton } from "../ui/IconButton";

interface GroupHomeProps {
  groups: Group[];
  onCreate(name: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onOpen(id: string): void;
  onSettings(): void;
}

export function GroupHome({ groups, onCreate, onRename, onDelete, onOpen, onSettings }: GroupHomeProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const submit = () => {
    const next = name.trim();
    if (!next) return;
    if (editingId) onRename(editingId, next);
    else onCreate(next);
    setName("");
    setEditingId(null);
  };

  return (
    <div className="page-shell">
      <button className="settings-trigger" onClick={onSettings}><Settings size={18} /> Settings</button>
      <header className="hero-grid">
        <div>
          <p className="eyebrow">Your circles</p>
          <h1>Good times.<br /><span>Fair shares.</span></h1>
          <p className="hero-copy">Create a group once, then settle every gathering in minutes—even when you’re offline.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-card orbit-one">₪</div>
          <div className="orbit-card orbit-two"><UsersRound size={31} /></div>
          <div className="orbit-dot" />
        </div>
      </header>

      <section className="panel create-strip" aria-labelledby="groups-title">
        <div>
          <p className="section-kicker">Start here</p>
          <h2 id="groups-title">{editingId ? "Rename your group" : "Create a new group"}</h2>
        </div>
        <div className="inline-form">
          <label className="sr-only" htmlFor="group-name">Group name</label>
          <input id="group-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="e.g. Friday crew" />
          <button className="primary-button" onClick={submit}><Plus size={19} /> {editingId ? "Save" : "Create"}</button>
        </div>
      </section>

      <section className="group-grid" aria-label="Groups">
        {groups.length === 0 ? (
          <div className="empty-card">
            <div className="empty-icon"><UsersRound size={28} /></div>
            <h3>Your first group starts here</h3>
            <p>Add family, friends, a trip crew, or any group that shares expenses.</p>
          </div>
        ) : groups.map((group, index) => (
          <article className={`group-card tone-${index % 3}`} key={group.id}>
            <div className="group-card-top">
              <span className="group-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="card-actions">
                <IconButton label={`Rename ${group.name}`} onClick={() => { setEditingId(group.id); setName(group.name); }}><Pencil size={17} /></IconButton>
                <IconButton label={`Delete ${group.name}`} onClick={() => onDelete(group.id)}><Trash2 size={17} /></IconButton>
              </div>
            </div>
            <button className="group-open" onClick={() => onOpen(group.id)}>
              <span>{group.name}</span><ArrowUpRight size={28} />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

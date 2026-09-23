import { useEffect, useMemo, useState } from "react";
import { GroupHome } from "../../components/groups/GroupHome";
import { GroupWorkspace } from "../../components/groups/GroupWorkspace";
import { EventScreen } from "../../components/gathering/EventScreen";
import { SettingsScreen } from "../../components/settings/SettingsScreen";
import { calculationSettingsFrom, defaultSettings, emptyPersistentData } from "../../domain/defaults";
import type { BillingUnit, Event, Language, Member, PersistentData, Settings } from "../../domain/models";
import { AndroidDataRepository } from "../../infrastructure/local/androidDataRepository";
import { AndroidReceiptStore } from "../../infrastructure/local/androidReceiptStore";
import { AndroidDataManagement } from "./AndroidDataManagement";
import { createId } from "../../utils/id";
import { dataWithEmbeddedReceipts, parsePortableBackup } from "../../application/portableBackup";

type Screen = { name: "home" } | { name: "families" } | { name: "settings" } | { name: "data" } | { name: "event"; eventId: string };
const receiptStore = new AndroidReceiptStore();
const repository = new AndroidDataRepository(receiptStore);
const today = () => new Date().toISOString().slice(0, 10);

export function AndroidApp() {
  const [data, setData] = useState<PersistentData>(emptyPersistentData);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [importing, setImporting] = useState(false);
  const primaryGroup = data.groups[0];
  const language = data.settings.language;
  const families = useMemo(() => primaryGroup ? data.billingUnits.filter((unit) => unit.groupId === primaryGroup.id) : [], [data.billingUnits, primaryGroup]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    let active = true;
    void repository.load().then((loaded) => { if (active) setData(loaded); }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "טעינת הנתונים המקומיים נכשלה");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const commit = (transform: (current: PersistentData) => PersistentData) => {
    setData((current) => {
      const next = transform(current);
      void repository.save(next).then((saved) => setData((latest) => latest === next ? saved : latest)).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "השמירה המקומית נכשלה");
      });
      return next;
    });
  };

  const setLanguage = (next: Language) => commit((current) => ({ ...current, settings: { ...current.settings, language: next } }));
  const saveSettings = (settings: Settings) => commit((current) => ({ ...current, settings }));
  const saveEvent = (event: Event) => commit((current) => ({ ...current, events: [...current.events.filter((item) => item.id !== event.id), event] }));
  const createEvent = (name: string, familyId?: string) => {
    if (!primaryGroup) return;
    const familyMembers = familyId ? data.members.filter((member) => member.billingUnitId === familyId && member.active) : [];
    const event: Event = { id: createId(), groupId: primaryGroup.id, name, date: today(), familyIds: familyId ? [familyId] : [], attendance: familyMembers.map((member) => ({ memberId: member.id, present: true })), expenses: [], calculationSettings: calculationSettingsFrom(data.settings), updatedAt: new Date().toISOString() };
    commit((current) => ({ ...current, events: [...current.events, event] }));
    setScreen({ name: "event", eventId: event.id });
  };
  const assignFamily = (familyId: string, eventId: string) => {
    const event = data.events.find((item) => item.id === eventId);
    if (!event || event.familyIds.includes(familyId)) return;
    const members = data.members.filter((member) => member.billingUnitId === familyId && member.active);
    saveEvent({ ...event, familyIds: [...event.familyIds, familyId], attendance: [...event.attendance, ...members.map((member) => ({ memberId: member.id, present: true }))], updatedAt: new Date().toISOString() });
  };
  const createFamily = (family: BillingUnit, members: Member[]) => commit((current) => ({ ...current, billingUnits: [...current.billingUnits, family], members: [...current.members, ...members] }));

  if (loading) return <main className="android-state"><img src="/favicon.svg" alt="" /><h1>מתחלקים</h1><p>פותח את הנתונים המקומיים…</p></main>;
  if (!primaryGroup) return <main className="android-onboarding" dir="rtl"><img src="/favicon.svg" alt="לוגו מתחלקים" /><p>האפליקציה הפרטית שלך</p><h1>מתחילים מקבוצה אחת מסודרת.</h1><label><span>שם הקבוצה</span><input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="לדוגמה: המשפחה שלנו" /></label><button disabled={!groupName.trim() || importing} onClick={() => { const group = { id: createId(), name: groupName.trim() }; commit((current) => ({ ...current, groups: [group], settings: { ...defaultSettings, language: "he" } })); }}>יצירת קבוצה מקומית</button><div className="onboarding-divider"><span>או</span></div><input hidden id="onboarding-backup" type="file" accept=".gesbackup,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setImporting(true); void file.text().then(parsePortableBackup).then((backup) => repository.replace(dataWithEmbeddedReceipts(backup))).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "הייבוא נכשל")).finally(() => setImporting(false)); }} /><label className="onboarding-import" htmlFor="onboarding-backup">{importing ? "מייבא את הנתונים…" : "ייבוא גיבוי מהאתר או מהאפליקציה"}</label>{error && <p className="submit-error">{error}</p>}</main>;

  const status = error ? "error" as const : "idle" as const;
  if (screen.name === "data") return <AndroidDataManagement data={data} repository={repository} receipts={receiptStore} onBack={() => setScreen({ name: "settings" })} onRestored={(restored) => { setData(restored); setScreen({ name: "home" }); }} />;
  if (screen.name === "settings") return <div className="android-app"><SettingsScreen settings={data.settings} language={language} onLanguageChange={setLanguage} onChange={saveSettings} onDataManagement={() => setScreen({ name: "data" })} onBack={() => setScreen({ name: "home" })} />{error && <div className="android-error">{error}</div>}</div>;
  if (screen.name === "families") return <div className="android-app"><GroupWorkspace group={primaryGroup} units={families} members={data.members} events={data.events} language={language} onLanguageChange={setLanguage} onBack={() => setScreen({ name: "home" })} onAddUnit={(name) => commit((current) => ({ ...current, billingUnits: [...current.billingUnits, { id: createId(), groupId: primaryGroup.id, name, order: families.length }] }))} onRenameUnit={(id, name) => commit((current) => ({ ...current, billingUnits: current.billingUnits.map((item) => item.id === id ? { ...item, name } : item) }))} onDeleteUnit={(id) => { if (data.events.some((event) => event.familyIds.includes(id)) || !window.confirm("למחוק את המשפחה וכל חבריה?")) return; commit((current) => ({ ...current, billingUnits: current.billingUnits.filter((item) => item.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) })); }} onAddMember={(familyId, details) => commit((current) => ({ ...current, members: [...current.members, { ...details, id: createId(), billingUnitId: familyId, order: current.members.filter((item) => item.billingUnitId === familyId).length }] }))} onUpdateMember={(id, details) => commit((current) => ({ ...current, members: current.members.map((item) => item.id === id ? { ...item, ...details } : item) }))} onDeleteMember={(id) => { if (!window.confirm("למחוק את החבר?")) return; commit((current) => ({ ...current, members: current.members.filter((item) => item.id !== id), events: current.events.map((event) => ({ ...event, attendance: event.attendance.filter((item) => item.memberId !== id), expenses: event.expenses.filter((expense) => expense.reportedByMemberId !== id) })) })); }} onAssignFamily={assignFamily} onCreateEventWithFamily={(familyId, name) => createEvent(name, familyId)} />{error && <div className="android-error">{error}</div>}</div>;
  if (screen.name === "event") {
    const event = data.events.find((item) => item.id === screen.eventId);
    if (event) return <div className="android-app"><EventScreen key={event.id} group={primaryGroup} repositoryFamilies={families} repositoryMembers={data.members} settings={data.settings} language={language} draft={event} cloudStatus={status} cloudMessage={error} onLanguageChange={setLanguage} onSave={saveEvent} onCreateFamily={createFamily} onBack={() => setScreen({ name: "home" })} onEditGroup={() => setScreen({ name: "families" })} /></div>;
  }
  return <div className="android-app"><GroupHome events={[...data.events].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))} families={families} cloudStatus={status} cloudMessage={error} language={language} onLanguageChange={setLanguage} onCreate={createEvent} onUpdate={(id, name) => { const event = data.events.find((item) => item.id === id); if (event) saveEvent({ ...event, name, updatedAt: new Date().toISOString() }); }} onDelete={(id) => { if (!window.confirm("למחוק את האירוע וכל ההוצאות שלו?")) return; commit((current) => ({ ...current, events: current.events.filter((item) => item.id !== id) })); }} onStart={(eventId) => setScreen({ name: "event", eventId })} onFamilies={() => setScreen({ name: "families" })} onSettings={() => setScreen({ name: "settings" })} /></div>;
}

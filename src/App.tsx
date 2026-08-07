import { useEffect, useMemo, useRef, useState } from "react";
import { GatheringScreen } from "./components/gathering/GatheringScreen";
import { FamilyHome } from "./components/groups/FamilyHome";
import { GroupHome } from "./components/groups/GroupHome";
import { GroupWorkspace } from "./components/groups/GroupWorkspace";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import type { CloudGroupSnapshot } from "./cloud/repository";
import { clearCloudDraft, createSharedGroup, deleteCloudGroup, deleteCloudMember, deleteCloudUnit, invitationUrl, joinSharedGroup, loadCloudGroup, saveCloudDraft, saveCloudGroup, saveCloudMember, saveCloudUnit, subscribeToCloudGroup } from "./cloud/repository";
import type { GatheringDraft, PersistentData } from "./domain/models";
import { createId } from "./utils/id";
import { localAppStorage } from "./storage/localStorage";
import { usePersistentData } from "./hooks/usePersistentData";

type Screen =
  | { name: "home" }
  | { name: "families" }
  | { name: "manage"; groupId: string; returnToEventId?: string }
  | { name: "gathering"; eventId: string }
  | { name: "settings" };
type CloudStatus = "idle" | "syncing" | "synced" | "error";

const today = () => new Date().toISOString().slice(0, 10);

const mergeSnapshot = (current: PersistentData, snapshot: CloudGroupSnapshot): PersistentData => {
  const previousUnitIds = new Set(current.billingUnits.filter((unit) => unit.groupId === snapshot.group.id).map((unit) => unit.id));
  return {
    ...current,
    groups: [...current.groups.filter((group) => group.id !== snapshot.group.id), snapshot.group],
    billingUnits: [...current.billingUnits.filter((unit) => unit.groupId !== snapshot.group.id), ...snapshot.units],
    members: [...current.members.filter((member) => !previousUnitIds.has(member.billingUnitId)), ...snapshot.members],
    gatheringDrafts: [...current.gatheringDrafts.filter((draft) => draft.groupId !== snapshot.group.id), ...snapshot.drafts],
  };
};

export default function App() {
  const [data, setData] = usePersistentData(localAppStorage);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [cloudMessage, setCloudMessage] = useState("");
  const handledInvite = useRef(false);
  const language = data.settings.language;
  const sharedGroupIds = useMemo(() => data.sharedGroups.map((item) => item.groupId).sort().join("|"), [data.sharedGroups]);
  const shared = (groupId: string) => data.sharedGroups.some((connection) => connection.groupId === groupId);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    if (handledInvite.current) return;
    const match = window.location.hash.match(/^#join=([a-f0-9]{64})$/);
    if (!match) return;
    handledInvite.current = true;
    queueMicrotask(() => setCloudStatus("syncing"));
    void joinSharedGroup(match[1]).then(async (groupId) => {
      const snapshot = await loadCloudGroup(groupId);
      setData((current) => ({ ...mergeSnapshot(current, snapshot), sharedGroups: [...current.sharedGroups.filter((item) => item.groupId !== groupId), { groupId, role: "editor" }] }));
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setCloudStatus("synced");
      setCloudMessage(language === "he" ? "הצטרפתם למשפחה ולאירועים המשותפים" : "Joined the shared family and its events");
    }).catch(() => { setCloudStatus("error"); setCloudMessage(language === "he" ? "קישור ההצטרפות אינו תקין או שפג תוקפו" : "The invitation is invalid or expired"); });
  }, [language, setData]);

  useEffect(() => {
    const groupIds = sharedGroupIds.split("|").filter(Boolean);
    if (!groupIds.length) return;
    const timers = new Map<string, number>();
    const refresh = (groupId: string) => {
      window.clearTimeout(timers.get(groupId));
      timers.set(groupId, window.setTimeout(() => { void loadCloudGroup(groupId).then((snapshot) => { setData((current) => mergeSnapshot(current, snapshot)); setCloudStatus("synced"); }).catch(() => setCloudStatus("error")); }, 250));
    };
    const unsubscribers = groupIds.map((groupId) => subscribeToCloudGroup(groupId, () => refresh(groupId)));
    void Promise.all(groupIds.map((groupId) => loadCloudGroup(groupId))).then((snapshots) => setData((current) => snapshots.reduce(mergeSnapshot, current))).catch(() => setCloudStatus("error"));
    return () => { timers.forEach((timer) => window.clearTimeout(timer)); unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, [sharedGroupIds, setData]);

  const runCloud = (operation: Promise<unknown>) => {
    setCloudStatus("syncing");
    void operation.then(() => setCloudStatus("synced")).catch(() => { setCloudStatus("error"); setCloudMessage(language === "he" ? "השינוי נשמר במכשיר, אך הסנכרון נכשל" : "Saved locally, but sync failed"); });
  };
  const setLanguage = (next: typeof language) => setData((current) => ({ ...current, settings: { ...current.settings, language: next } }));
  const saveEvent = (draft: GatheringDraft) => {
    const previous = data.gatheringDrafts.find((item) => item.id === draft.id);
    setData((current) => ({ ...current, gatheringDrafts: [...current.gatheringDrafts.filter((item) => item.id !== draft.id), draft] }));
    if (shared(draft.groupId)) runCloud(saveCloudDraft(draft.groupId, draft, previous));
  };
  const createEvent = (name: string, groupId: string) => {
    const unitIds = new Set(data.billingUnits.filter((unit) => unit.groupId === groupId).map((unit) => unit.id));
    const event: GatheringDraft = { id: createId(), groupId, name, date: today(), attendance: data.members.filter((member) => member.active && unitIds.has(member.billingUnitId)).map((member) => ({ memberId: member.id, present: true })), expenses: [], updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, gatheringDrafts: [...current.gatheringDrafts, event] }));
    if (shared(groupId)) runCloud(saveCloudDraft(groupId, event));
    setScreen({ name: "gathering", eventId: event.id });
  };
  const updateEvent = (id: string, name: string, groupId: string) => {
    const previous = data.gatheringDrafts.find((event) => event.id === id);
    if (!previous) return;
    const familyChanged = previous.groupId !== groupId;
    const unitIds = new Set(data.billingUnits.filter((unit) => unit.groupId === groupId).map((unit) => unit.id));
    const updated: GatheringDraft = { ...previous, name, groupId, updatedAt: new Date().toISOString(), ...(familyChanged ? { attendance: data.members.filter((member) => member.active && unitIds.has(member.billingUnitId)).map((member) => ({ memberId: member.id, present: true })), expenses: [] } : {}) };
    setData((current) => ({ ...current, gatheringDrafts: current.gatheringDrafts.map((event) => event.id === id ? updated : event) }));
    if (familyChanged) {
      if (shared(previous.groupId) || shared(groupId)) runCloud((async () => {
        if (shared(previous.groupId)) await clearCloudDraft(id);
        if (shared(groupId)) await saveCloudDraft(groupId, updated);
      })());
    } else if (shared(groupId)) runCloud(saveCloudDraft(groupId, updated, previous));
  };
  const deleteEvent = (id: string) => {
    const event = data.gatheringDrafts.find((item) => item.id === id);
    setData((current) => ({ ...current, gatheringDrafts: current.gatheringDrafts.filter((item) => item.id !== id) }));
    if (event && shared(event.groupId)) runCloud(clearCloudDraft(id));
  };
  const shareGroup = async (groupId: string) => {
    try {
      setCloudStatus("syncing");
      let connection = data.sharedGroups.find((item) => item.groupId === groupId);
      if (!connection) {
        const inviteToken = await createSharedGroup(data, groupId);
        connection = { groupId, inviteToken, role: "owner" };
        setData((current) => ({ ...current, sharedGroups: [...current.sharedGroups, connection!] }));
      }
      if (!connection.inviteToken) { setCloudMessage(language === "he" ? "המשפחה משותפת. רק הבעלים יכול להפיץ קישור." : "This family is shared. Only the owner can share its link."); setCloudStatus("synced"); return; }
      const url = invitationUrl(connection.inviteToken);
      if (navigator.share) await navigator.share({ title: data.groups.find((group) => group.id === groupId)?.name, url });
      else await navigator.clipboard.writeText(url);
      setCloudMessage(language === "he" ? "קישור השיתוף מוכן" : "Share link ready");
      setCloudStatus("synced");
    } catch { setCloudStatus("error"); setCloudMessage(language === "he" ? "לא הצלחנו להפעיל שיתוף כרגע" : "Could not enable sharing"); }
  };

  if (screen.name === "settings") return <SettingsScreen settings={data.settings} language={language} onLanguageChange={setLanguage} onChange={(settings) => setData((current) => ({ ...current, settings }))} onBack={() => setScreen({ name: "home" })} />;

  if (screen.name === "families") return <FamilyHome groups={data.groups} units={data.billingUnits} members={data.members} language={language} onBack={() => setScreen({ name: "home" })} onCreate={(name) => setData((current) => ({ ...current, groups: [...current.groups, { id: createId(), name }] }))} onRename={(id, name) => { const group = data.groups.find((item) => item.id === id); if (!group) return; const updated = { ...group, name }; setData((current) => ({ ...current, groups: current.groups.map((item) => item.id === id ? updated : item) })); if (shared(id)) runCloud(saveCloudGroup(updated)); }} onDelete={(id) => { const unitIds = new Set(data.billingUnits.filter((unit) => unit.groupId === id).map((unit) => unit.id)); setData((current) => ({ ...current, groups: current.groups.filter((group) => group.id !== id), billingUnits: current.billingUnits.filter((unit) => unit.groupId !== id), members: current.members.filter((member) => !unitIds.has(member.billingUnitId)), gatheringDrafts: current.gatheringDrafts.filter((event) => event.groupId !== id), sharedGroups: current.sharedGroups.filter((item) => item.groupId !== id) })); if (shared(id)) runCloud(deleteCloudGroup(id)); }} onManage={(groupId) => setScreen({ name: "manage", groupId })} />;

  if (screen.name === "gathering") {
    const draft = data.gatheringDrafts.find((event) => event.id === screen.eventId);
    const group = draft && data.groups.find((item) => item.id === draft.groupId);
    if (draft && group) return <GatheringScreen key={`${draft.id}:${draft.groupId}`} group={group} groups={data.groups} units={data.billingUnits.filter((unit) => unit.groupId === group.id)} members={data.members} settings={data.settings} language={language} draft={draft} onLanguageChange={setLanguage} onSave={saveEvent} onBack={() => setScreen({ name: "home" })} onEditGroup={() => setScreen({ name: "manage", groupId: group.id, returnToEventId: draft.id })} onGroupChange={(groupId, name) => updateEvent(draft.id, name, groupId)} />;
  }

  if (screen.name === "manage") {
    const group = data.groups.find((item) => item.id === screen.groupId);
    if (group) return <GroupWorkspace group={group} units={data.billingUnits.filter((unit) => unit.groupId === group.id)} members={data.members} language={language} returnToGathering={Boolean(screen.returnToEventId)} onLanguageChange={setLanguage} onBack={() => setScreen(screen.returnToEventId ? { name: "gathering", eventId: screen.returnToEventId } : { name: "families" })} onAddUnit={(name) => { const unit = { id: createId(), groupId: group.id, name, order: data.billingUnits.filter((item) => item.groupId === group.id).length }; setData((current) => ({ ...current, billingUnits: [...current.billingUnits, unit] })); if (shared(group.id)) runCloud(saveCloudUnit(unit)); }} onRenameUnit={(id, name) => { const unit = data.billingUnits.find((item) => item.id === id); if (!unit) return; const updated = { ...unit, name }; setData((current) => ({ ...current, billingUnits: current.billingUnits.map((item) => item.id === id ? updated : item) })); if (shared(group.id)) runCloud(saveCloudUnit(updated)); }} onDeleteUnit={(id) => { setData((current) => ({ ...current, billingUnits: current.billingUnits.filter((unit) => unit.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) })); if (shared(group.id)) runCloud(deleteCloudUnit(id)); }} onAddMember={(unitId, details) => { const member = { ...details, id: createId(), billingUnitId: unitId, order: data.members.filter((item) => item.billingUnitId === unitId).length }; setData((current) => ({ ...current, members: [...current.members, member] })); if (shared(group.id)) runCloud(saveCloudMember(group.id, member)); }} onUpdateMember={(id, details) => { const member = data.members.find((item) => item.id === id); if (!member) return; const updated = { ...member, ...details }; setData((current) => ({ ...current, members: current.members.map((item) => item.id === id ? updated : item) })); if (shared(group.id)) runCloud(saveCloudMember(group.id, updated)); }} onDeleteMember={(id) => { setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== id) })); if (shared(group.id)) runCloud(deleteCloudMember(id)); }} onStartGathering={screen.returnToEventId ? () => setScreen({ name: "gathering", eventId: screen.returnToEventId! }) : undefined} />;
  }

  return <GroupHome groups={data.groups} events={[...data.gatheringDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))} sharedGroups={data.sharedGroups} cloudStatus={cloudStatus} cloudMessage={cloudMessage} language={language} onLanguageChange={setLanguage} onCreate={createEvent} onUpdate={updateEvent} onDelete={deleteEvent} onStart={(eventId) => setScreen({ name: "gathering", eventId })} onManageFamily={(groupId, eventId) => setScreen({ name: "manage", groupId, returnToEventId: eventId })} onShare={(groupId) => { void shareGroup(groupId); }} onFamilies={() => setScreen({ name: "families" })} onSettings={() => setScreen({ name: "settings" })} />;
}

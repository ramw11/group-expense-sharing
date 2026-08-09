import { useEffect, useMemo, useRef, useState } from "react";
import { GatheringScreen } from "./components/gathering/GatheringScreen";
import { GroupHome } from "./components/groups/GroupHome";
import { GroupWorkspace } from "./components/groups/GroupWorkspace";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { ParticipantExpense, ParticipantHome, ParticipantJoinState } from "./components/participant/ParticipantFlow";
import type { CloudGroupSnapshot } from "./cloud/repository";
import { clearCloudDraft, createSharedGroup, deleteCloudMember, deleteCloudUnit, invitationUrl, joinSharedGroup, loadCloudGroup, parseInvitationUrl, recoverOwnedGroup, saveCloudDraft, saveCloudMember, saveCloudUnit, submitCloudExpense, subscribeToCloudGroup } from "./cloud/repository";
import type { BillingUnit, Expense, GatheringDraft, Member, PersistentData } from "./domain/models";
import { createId } from "./utils/id";
import { localAppStorage } from "./storage/localStorage";
import { usePersistentData } from "./hooks/usePersistentData";

type Screen = { name: "participant-home" } | { name: "participant-expense"; eventId: string } | { name: "admin-home" } | { name: "families" } | { name: "gathering"; eventId: string } | { name: "settings" };
type CloudStatus = "idle" | "syncing" | "synced" | "error";
const today = () => new Date().toISOString().slice(0, 10);

const mergeSnapshot = (current: PersistentData, snapshot: CloudGroupSnapshot): PersistentData => {
  return {
    ...current,
    groups: [snapshot.group],
    billingUnits: snapshot.units,
    members: snapshot.members,
    gatheringDrafts: snapshot.drafts,
  };
};

export default function App() {
  const [data, setData] = usePersistentData(localAppStorage);
  const [screen, setScreen] = useState<Screen>({ name: "participant-home" });
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [cloudMessage, setCloudMessage] = useState("");
  const incomingInvitation = useMemo(() => parseInvitationUrl(window.location.href), []);
  const [inviteStatus, setInviteStatus] = useState<"none" | "joining" | "error">(incomingInvitation ? "joining" : "none");
  const handledInvite = useRef(false);
  const attemptedOwnerRecovery = useRef(false);
  const language = data.settings.language;
  const primaryGroup = data.groups[0];
  const repositoryFamilies = primaryGroup ? data.billingUnits.filter((unit) => unit.groupId === primaryGroup.id) : [];
  const sharedGroupIds = useMemo(() => data.sharedGroups.map((item) => item.groupId).sort().join("|"), [data.sharedGroups]);
  const shared = (groupId: string) => data.sharedGroups.some((connection) => connection.groupId === groupId);
  const joinedGroupIds = new Set(data.sharedGroups.map((connection) => connection.groupId));
  const participantEvents = data.gatheringDrafts.filter((event) => joinedGroupIds.has(event.groupId) && event.familyIds.some((familyId) => data.members.some((member) => member.billingUnitId === familyId && member.active))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const canManage = data.sharedGroups.length === 0 || data.sharedGroups.some((connection) => connection.role === "owner");

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === "he" ? "rtl" : "ltr"; }, [language]);

  useEffect(() => {
    if (handledInvite.current || !incomingInvitation) return;
    handledInvite.current = true;
    queueMicrotask(() => setCloudStatus("syncing"));
    void joinSharedGroup(incomingInvitation.token).then(async (groupId) => {
      const snapshot = await loadCloudGroup(groupId);
      setData((current) => ({ ...mergeSnapshot(current, snapshot), sharedGroups: [...current.sharedGroups.filter((item) => item.groupId !== groupId), { groupId, role: current.sharedGroups.some((item) => item.groupId === groupId && item.role === "owner") ? "owner" : "participant" }] }));
      window.history.replaceState(null, "", window.location.pathname);
      const requestedEventId = incomingInvitation.eventId;
      setScreen(requestedEventId && snapshot.drafts.some((draft) => draft.id === requestedEventId) ? { name: "participant-expense", eventId: requestedEventId } : { name: "participant-home" });
      setInviteStatus("none");
      setCloudStatus("synced"); setCloudMessage(language === "he" ? "הצטרפתם למאגר ולאירועים המשותפים" : "Joined the shared repository and events");
    }).catch(() => { setInviteStatus("error"); setCloudStatus("error"); setCloudMessage(language === "he" ? "קישור ההצטרפות אינו תקין או שפג תוקפו" : "The invitation is invalid or expired"); });
  }, [incomingInvitation, language, setData]);

  useEffect(() => {
    if (attemptedOwnerRecovery.current || sharedGroupIds || incomingInvitation) return;
    attemptedOwnerRecovery.current = true;
    void recoverOwnedGroup().then(async (connection) => {
      if (!connection) return;
      setCloudStatus("syncing");
      const snapshot = await loadCloudGroup(connection.groupId);
      setData((current) => ({ ...mergeSnapshot(current, snapshot), sharedGroups: [{ ...connection, role: "owner" }] }));
      setCloudStatus("synced");
      setCloudMessage(language === "he" ? "השיתוף הקיים שוחזר" : "Existing sharing restored");
    }).catch(() => setCloudStatus("idle"));
  }, [incomingInvitation, language, setData, sharedGroupIds]);

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
  const createEvent = (name: string, familyId?: string) => {
    if (!primaryGroup) return;
    const familyMembers = familyId ? data.members.filter((member) => member.billingUnitId === familyId && member.active) : [];
    const event: GatheringDraft = { id: createId(), groupId: primaryGroup.id, name, date: today(), familyIds: familyId ? [familyId] : [], attendance: familyMembers.map((member) => ({ memberId: member.id, present: true })), expenses: [], updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, gatheringDrafts: [...current.gatheringDrafts, event] }));
    if (shared(event.groupId)) runCloud(saveCloudDraft(event.groupId, event));
    setScreen({ name: "gathering", eventId: event.id });
  };
  const assignFamily = (familyId: string, eventId: string) => {
    const event = data.gatheringDrafts.find((item) => item.id === eventId);
    if (!event || event.familyIds.includes(familyId)) return;
    const familyMembers = data.members.filter((member) => member.billingUnitId === familyId && member.active);
    const updated: GatheringDraft = { ...event, familyIds: [...event.familyIds, familyId], attendance: [...event.attendance, ...familyMembers.map((member) => ({ memberId: member.id, present: true }))], updatedAt: new Date().toISOString() };
    saveEvent(updated);
  };
  const createFamily = (family: BillingUnit, members: Member[]) => {
    setData((current) => ({ ...current, billingUnits: [...current.billingUnits, family], members: [...current.members, ...members] }));
    if (shared(family.groupId)) runCloud((async () => { await saveCloudUnit(family); for (const member of members) await saveCloudMember(family.groupId, member); })());
  };
  const deleteEvent = (id: string) => {
    const event = data.gatheringDrafts.find((item) => item.id === id);
    setData((current) => ({ ...current, gatheringDrafts: current.gatheringDrafts.filter((item) => item.id !== id) }));
    if (event && shared(event.groupId)) runCloud(clearCloudDraft(id));
  };
  const submitParticipantExpense = async (eventId: string, expense: Expense) => {
    const event = data.gatheringDrafts.find((item) => item.id === eventId);
    if (!event || !shared(event.groupId)) throw new Error("Shared event not found");
    await submitCloudExpense(event.groupId, event.id, expense);
    setData((current) => ({ ...current, gatheringDrafts: current.gatheringDrafts.map((item) => item.id === eventId ? { ...item, expenses: [...item.expenses, expense], updatedAt: new Date().toISOString() } : item) }));
  };
  const createShareLink = async (groupId: string, pendingDraft?: GatheringDraft, eventId?: string) => {
    try {
      setCloudStatus("syncing");
      const sourceData = pendingDraft ? { ...data, gatheringDrafts: [...data.gatheringDrafts.filter((item) => item.id !== pendingDraft.id), pendingDraft] } : data;
      if (pendingDraft) setData(sourceData);
      let connection = sourceData.sharedGroups.find((item) => item.groupId === groupId);
      if (!connection) {
        const recovered = await recoverOwnedGroup();
        if (recovered) {
          const snapshot = await loadCloudGroup(recovered.groupId);
          if (pendingDraft) {
            const normalizedDraft = { ...pendingDraft, groupId: recovered.groupId };
            await saveCloudDraft(recovered.groupId, normalizedDraft, snapshot.drafts.find((item) => item.id === normalizedDraft.id));
            snapshot.drafts = [...snapshot.drafts.filter((item) => item.id !== normalizedDraft.id), normalizedDraft];
          }
          connection = { ...recovered, role: "owner" };
          setData((current) => ({ ...mergeSnapshot(current, snapshot), sharedGroups: [connection!] }));
        } else {
          const inviteToken = await createSharedGroup(sourceData, groupId);
          connection = { groupId, inviteToken, role: "owner" };
          setData((current) => ({ ...current, sharedGroups: [connection!] }));
        }
      }
      if (!connection.inviteToken) throw new Error("Only the owner can create a reporting link");
      const url = invitationUrl(connection.inviteToken, eventId);
      setCloudMessage(language === "he" ? "קישור הדיווח מוכן לשליחה" : "The reporting link is ready to send"); setCloudStatus("synced");
      return url;
    } catch (error) {
      setCloudStatus("error"); setCloudMessage(language === "he" ? "לא הצלחנו להפעיל שיתוף כרגע" : "Could not enable sharing");
      throw error;
    }
  };
  const participantHome = <ParticipantHome events={participantEvents} families={repositoryFamilies} joined={data.sharedGroups.length > 0} canManage={canManage} language={language} statusMessage={cloudMessage} onLanguageChange={setLanguage} onChooseEvent={(eventId) => setScreen({ name: "participant-expense", eventId })} onManage={() => setScreen({ name: "admin-home" })} />;

  if (inviteStatus !== "none") return <ParticipantJoinState language={language} status={inviteStatus} onLanguageChange={setLanguage} />;

  if (screen.name === "settings") return <SettingsScreen settings={data.settings} language={language} onLanguageChange={setLanguage} onChange={(settings) => setData((current) => ({ ...current, settings }))} onBack={() => setScreen({ name: "admin-home" })} />;

  if (screen.name === "families" && primaryGroup) return <GroupWorkspace group={primaryGroup} units={repositoryFamilies} members={data.members} events={data.gatheringDrafts} language={language} onLanguageChange={setLanguage} onBack={() => setScreen({ name: "admin-home" })} onAddUnit={(name) => { const family = { id: createId(), groupId: primaryGroup.id, name, order: repositoryFamilies.length }; setData((current) => ({ ...current, billingUnits: [...current.billingUnits, family] })); if (shared(primaryGroup.id)) runCloud(saveCloudUnit(family)); }} onRenameUnit={(id, name) => { const family = data.billingUnits.find((item) => item.id === id); if (!family) return; const updated = { ...family, name }; setData((current) => ({ ...current, billingUnits: current.billingUnits.map((item) => item.id === id ? updated : item) })); if (shared(primaryGroup.id)) runCloud(saveCloudUnit(updated)); }} onDeleteUnit={(id) => { if (data.gatheringDrafts.some((event) => event.familyIds.includes(id))) return; setData((current) => ({ ...current, billingUnits: current.billingUnits.filter((unit) => unit.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) })); if (shared(primaryGroup.id)) runCloud(deleteCloudUnit(id)); }} onAddMember={(familyId, details) => { const member = { ...details, id: createId(), billingUnitId: familyId, order: data.members.filter((item) => item.billingUnitId === familyId).length }; setData((current) => ({ ...current, members: [...current.members, member] })); if (shared(primaryGroup.id)) runCloud(saveCloudMember(primaryGroup.id, member)); }} onUpdateMember={(id, details) => { const member = data.members.find((item) => item.id === id); if (!member) return; const updated = { ...member, ...details }; setData((current) => ({ ...current, members: current.members.map((item) => item.id === id ? updated : item) })); if (shared(primaryGroup.id)) runCloud(saveCloudMember(primaryGroup.id, updated)); }} onDeleteMember={(id) => { setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== id) })); if (shared(primaryGroup.id)) runCloud(deleteCloudMember(id)); }} onAssignFamily={(familyId, eventId) => assignFamily(familyId, eventId)} onCreateEventWithFamily={(familyId, name) => createEvent(name, familyId)} />;

  if (screen.name === "gathering") {
    const draft = data.gatheringDrafts.find((event) => event.id === screen.eventId);
    if (draft && primaryGroup) return <GatheringScreen key={`${draft.id}:${draft.expenses.length}`} group={primaryGroup} repositoryFamilies={repositoryFamilies} repositoryMembers={data.members} settings={data.settings} language={language} draft={draft} shared={shared(primaryGroup.id)} cloudStatus={cloudStatus} cloudMessage={cloudMessage} onLanguageChange={setLanguage} onSave={saveEvent} onShare={(currentDraft) => createShareLink(currentDraft.groupId, currentDraft, currentDraft.id)} onCreateFamily={createFamily} onBack={() => setScreen({ name: "admin-home" })} onEditGroup={() => setScreen({ name: "families" })} />;
  }

  if (screen.name === "participant-expense") {
    const event = participantEvents.find((item) => item.id === screen.eventId);
    if (event) return <ParticipantExpense event={event} families={repositoryFamilies} members={data.members} settings={data.settings} language={language} onLanguageChange={setLanguage} onBack={() => setScreen({ name: "participant-home" })} onSubmit={(expense) => submitParticipantExpense(event.id, expense)} />;
    return participantHome;
  }

  if (screen.name === "participant-home") return participantHome;

  return <GroupHome events={[...data.gatheringDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))} families={repositoryFamilies} groupId={primaryGroup?.id ?? ""} shared={primaryGroup ? shared(primaryGroup.id) : false} cloudStatus={cloudStatus} cloudMessage={cloudMessage} language={language} onLanguageChange={setLanguage} onCreate={(name) => createEvent(name)} onUpdate={(id, name) => { const event = data.gatheringDrafts.find((item) => item.id === id); if (event) saveEvent({ ...event, name, updatedAt: new Date().toISOString() }); }} onDelete={deleteEvent} onStart={(eventId) => setScreen({ name: "gathering", eventId })} onShare={(groupId) => createShareLink(groupId)} onFamilies={() => setScreen({ name: "families" })} onSettings={() => setScreen({ name: "settings" })} onParticipantHome={() => setScreen({ name: "participant-home" })} />;
}

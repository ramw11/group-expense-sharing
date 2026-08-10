import { useEffect, useMemo, useRef, useState } from "react";
import { EventScreen } from "./components/gathering/EventScreen";
import { GroupHome } from "./components/groups/GroupHome";
import { GroupWorkspace } from "./components/groups/GroupWorkspace";
import { ParticipantExpense, ParticipantHome, ParticipantJoinState } from "./components/participant/ParticipantFlow";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { AdminAccessScreen } from "./components/admin/AdminAccessScreen";
import type { CloudGroupSnapshot } from "./cloud/repository";
import {
  createEventReportingToken,
  bootstrapAdminCode,
  changeAdminCode,
  completeLegacyStateMigration,
  deleteCloudEvent,
  deleteCloudMember,
  deleteCloudUnit,
  findAccessibleEvent,
  getAdminAccessStatus,
  invitationUrl,
  joinLegacyGroup,
  joinSharedEvent,
  loginAdmin,
  loadCloudGroup,
  parseInvitationUrl,
  saveCloudEvent,
  saveCloudMember,
  saveCloudSettings,
  saveCloudUnit,
  submitCloudExpense,
  updateOwnExpense,
  subscribeToCloudGroup,
} from "./cloud/repository";
import { calculationSettingsFrom, defaultSettings, emptyPersistentData } from "./domain/defaults";
import type { BillingUnit, CloudConnection, Event, Expense, Language, Member, PersistentData, Settings } from "./domain/models";
import { discardLegacyBusinessData, loadDevicePreferences, loadLegacyBusinessData, saveDevicePreferences } from "./storage/localStorage";
import { createId } from "./utils/id";

type Screen = { name: "participant-home" } | { name: "participant-expense"; eventId: string } | { name: "admin-access"; bootstrap: boolean } | { name: "admin-home" } | { name: "families" } | { name: "event"; eventId: string } | { name: "settings" };
type CloudStatus = "idle" | "syncing" | "synced" | "error";
const today = () => new Date().toISOString().slice(0, 10);

const snapshotData = (current: PersistentData, snapshot: CloudGroupSnapshot): PersistentData => ({
  version: 6,
  groups: [snapshot.group],
  billingUnits: snapshot.units,
  members: snapshot.members,
  events: snapshot.events,
  settings: { ...snapshot.settings, language: current.settings.language },
});

const migrateLegacyOwnerState = async (snapshot: CloudGroupSnapshot) => {
  if (snapshot.migrationVersion >= 1) return snapshot;
  const legacy = loadLegacyBusinessData();
  const belongsToGroup = Boolean(legacy?.groups.some((group) => group.id === snapshot.group.id));
  const legacySettings = belongsToGroup && legacy ? legacy.settings : undefined;
  const eventSettingsById = Object.fromEntries(snapshot.events.map((event) => {
    const legacyEvent = belongsToGroup && legacy ? legacy.events.find((item) => item.id === event.id) : undefined;
    return [event.id, legacyEvent?.calculationSettings ?? (legacySettings ? calculationSettingsFrom(legacySettings) : event.calculationSettings)];
  }));
  await completeLegacyStateMigration(snapshot.group.id, legacySettings, eventSettingsById);
  discardLegacyBusinessData();
  return loadCloudGroup(snapshot.group.id);
};

export default function App() {
  const initialPreferences = useMemo(() => loadDevicePreferences(), []);
  const [data, setData] = useState<PersistentData>(() => ({ ...emptyPersistentData(), settings: { ...defaultSettings, language: initialPreferences.language } }));
  const [connection, setConnection] = useState<CloudConnection>();
  const [screen, setScreen] = useState<Screen>({ name: "participant-home" });
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [cloudMessage, setCloudMessage] = useState("");
  const incomingInvitation = useMemo(() => parseInvitationUrl(window.location.href), []);
  const adminEntry = useMemo(() => new URL(window.location.href).searchParams.get("view") === "admin", []);
  const [inviteStatus, setInviteStatus] = useState<"none" | "joining" | "error">(incomingInvitation?.token || incomingInvitation?.legacyToken ? "joining" : "none");
  const bootstrapped = useRef(false);
  const language = data.settings.language;
  const primaryGroup = data.groups[0];
  const repositoryFamilies = primaryGroup ? data.billingUnits.filter((unit) => unit.groupId === primaryGroup.id) : [];
  const participantEvents = connection?.role === "participant" && connection.eventId ? data.events.filter((event) => event.id === connection.eventId) : [];

  const refreshGroup = async (groupId: string) => {
    const snapshot = await loadCloudGroup(groupId);
    setData((current) => snapshotData(current, snapshot));
    return snapshot;
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
    saveDevicePreferences({
      version: 1,
      language,
      activeGroupId: connection?.role === "owner" ? connection.groupId : initialPreferences.activeGroupId,
      participantEventId: connection?.role === "participant" ? connection.eventId : undefined,
    });
  }, [connection, initialPreferences.activeGroupId, language]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const bootstrap = async () => {
      try {
        let participantAccess: { groupId: string; eventId: string } | undefined;
        if (incomingInvitation?.token) participantAccess = await joinSharedEvent(incomingInvitation.token);
        else if (incomingInvitation?.legacyToken) participantAccess = await joinLegacyGroup(incomingInvitation.legacyToken, incomingInvitation.eventId);
        else if (incomingInvitation?.eventId) participantAccess = await findAccessibleEvent(incomingInvitation.eventId);
        else if (!adminEntry && initialPreferences.participantEventId) participantAccess = await findAccessibleEvent(initialPreferences.participantEventId);

        if (participantAccess) {
          const snapshot = await refreshGroup(participantAccess.groupId);
          if (!snapshot.events.some((event) => event.id === participantAccess!.eventId)) throw new Error("Event not found");
          setConnection({ groupId: participantAccess.groupId, eventId: participantAccess.eventId, role: "participant" });
          setScreen({ name: "participant-expense", eventId: participantAccess.eventId });
          setInviteStatus("none");
          setCloudStatus("synced");
          const url = new URL(window.location.href);
          url.search = ""; url.hash = ""; url.searchParams.set("event", participantAccess.eventId);
          window.history.replaceState(null, "", url.toString());
          return;
        }

        const adminStatus = await getAdminAccessStatus();
        if (adminStatus.isAdmin && adminStatus.groupId) {
          const loaded = await loadCloudGroup(adminStatus.groupId);
          const snapshot = await migrateLegacyOwnerState(loaded);
          setData((current) => snapshotData(current, snapshot));
          setConnection({ groupId: adminStatus.groupId, role: "owner" });
          setScreen({ name: "admin-home" });
          setCloudStatus("synced");
        } else if (adminEntry || (adminStatus.canBootstrap && !adminStatus.configured)) {
          setScreen({ name: "admin-access", bootstrap: adminStatus.canBootstrap && !adminStatus.configured });
        }
      } catch {
        if (incomingInvitation) setInviteStatus("error");
        setCloudStatus("error");
        setCloudMessage(language === "he" ? "לא הצלחנו לפתוח את האירוע" : "Could not open the event");
      }
    };
    void bootstrap();
  }, [adminEntry, incomingInvitation, initialPreferences.activeGroupId, initialPreferences.participantEventId, language]);

  useEffect(() => {
    if (!connection?.groupId) return;
    let timer = 0;
    const unsubscribe = subscribeToCloudGroup(connection.groupId, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void refreshGroup(connection.groupId).then(() => setCloudStatus("synced")).catch(() => setCloudStatus("error"));
      }, 200);
    });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [connection?.groupId]);

  const runCloud = async (operation: Promise<unknown>, refresh = true) => {
    if (!connection) throw new Error("Cloud connection is not ready");
    setCloudStatus("syncing");
    try {
      await operation;
      if (refresh) await refreshGroup(connection.groupId);
      setCloudMessage("");
      setCloudStatus("synced");
    } catch (error) {
      setCloudStatus("error");
      setCloudMessage(language === "he" ? "השמירה נכשלה. הנתונים נטענו מחדש מהשרת." : "Save failed. Data was reloaded from the server.");
      await refreshGroup(connection.groupId).catch(() => undefined);
      throw error;
    }
  };

  const openAdminAccess = async () => {
    setCloudStatus("syncing");
    try {
      const status = await getAdminAccessStatus();
      const groupId = status.isAdmin ? status.groupId : undefined;
      if (!groupId) {
        setScreen({ name: "admin-access", bootstrap: status.canBootstrap && !status.configured });
        setCloudStatus("idle");
        return;
      }
      await refreshGroup(groupId);
      setConnection({ groupId, role: "owner" });
      setScreen({ name: "admin-home" });
      setCloudStatus("synced");
    } catch {
      setCloudStatus("error");
      setCloudMessage(language === "he" ? "לא הצלחנו לפתוח את אזור הניהול" : "Could not open manager area");
    }
  };

  const authenticateAdmin = async (code: string, bootstrap: boolean) => {
    const groupId = bootstrap ? await bootstrapAdminCode(code) : await loginAdmin(code);
    const loaded = await loadCloudGroup(groupId);
    const snapshot = await migrateLegacyOwnerState(loaded);
    setData((current) => snapshotData(current, snapshot));
    setConnection({ groupId, role: "owner" });
    setScreen({ name: "admin-home" });
    setCloudStatus("synced");
    const url = new URL(window.location.href);
    url.search = ""; url.hash = ""; url.searchParams.set("view", "admin");
    window.history.replaceState(null, "", url.toString());
  };

  const setLanguage = (next: Language) => setData((current) => ({ ...current, settings: { ...current.settings, language: next } }));
  const saveEvent = (event: Event) => {
    if (!connection || connection.role !== "owner") return;
    const previous = data.events.find((item) => item.id === event.id);
    setData((current) => ({ ...current, events: [...current.events.filter((item) => item.id !== event.id), event] }));
    void runCloud(saveCloudEvent(connection.groupId, event, previous)).catch(() => undefined);
  };
  const createEvent = (name: string, familyId?: string) => {
    if (!primaryGroup || connection?.role !== "owner") return;
    const familyMembers = familyId ? data.members.filter((member) => member.billingUnitId === familyId && member.active) : [];
    const event: Event = { id: createId(), groupId: primaryGroup.id, name, date: today(), familyIds: familyId ? [familyId] : [], attendance: familyMembers.map((member) => ({ memberId: member.id, present: true })), expenses: [], calculationSettings: calculationSettingsFrom(data.settings), updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, events: [...current.events, event] }));
    void runCloud(saveCloudEvent(primaryGroup.id, event)).catch(() => undefined);
    setScreen({ name: "event", eventId: event.id });
  };
  const assignFamily = (familyId: string, eventId: string) => {
    const event = data.events.find((item) => item.id === eventId);
    if (!event || event.familyIds.includes(familyId)) return;
    const familyMembers = data.members.filter((member) => member.billingUnitId === familyId && member.active);
    saveEvent({ ...event, familyIds: [...event.familyIds, familyId], attendance: [...event.attendance, ...familyMembers.map((member) => ({ memberId: member.id, present: true }))], updatedAt: new Date().toISOString() });
  };
  const createFamily = (family: BillingUnit, members: Member[]) => {
    if (!connection || connection.role !== "owner") return;
    setData((current) => ({ ...current, billingUnits: [...current.billingUnits, family], members: [...current.members, ...members] }));
    void runCloud((async () => { await saveCloudUnit(family); for (const member of members) await saveCloudMember(connection.groupId, member); })()).catch(() => undefined);
  };
  const createShareLink = async (event: Event) => {
    if (!connection || connection.role !== "owner") throw new Error("Owner access required");
    const previous = data.events.find((item) => item.id === event.id);
    await runCloud(saveCloudEvent(connection.groupId, event, previous));
    const token = await createEventReportingToken(event.id);
    return invitationUrl(token, event.id);
  };
  const submitParticipantExpense = async (eventId: string, expense: Expense) => {
    const event = data.events.find((item) => item.id === eventId);
    if (!event || connection?.role !== "participant" || connection.eventId !== eventId) throw new Error("Shared event not found");
    await runCloud(submitCloudExpense(connection.groupId, eventId, expense));
  };
  const updateParticipantExpense = async (expense: Expense) => {
    if (!connection || connection.role !== "participant" || !connection.eventId) throw new Error("Participant access required");
    await runCloud(updateOwnExpense(connection.groupId, connection.eventId, expense));
  };
  const saveSettings = (settings: Settings) => {
    setData((current) => ({ ...current, settings }));
    if (connection?.role === "owner") void runCloud(saveCloudSettings(connection.groupId, settings)).catch(() => undefined);
  };

  const participantHome = <ParticipantHome events={participantEvents} families={repositoryFamilies} joined={participantEvents.length > 0} canManage language={language} statusMessage={cloudMessage} onLanguageChange={setLanguage} onChooseEvent={(eventId) => setScreen({ name: "participant-expense", eventId })} onManage={() => { void openAdminAccess(); }} />;

  if (inviteStatus !== "none") return <ParticipantJoinState language={language} status={inviteStatus} onLanguageChange={setLanguage} />;
  if (screen.name === "admin-access") return <AdminAccessScreen language={language} bootstrap={screen.bootstrap} onLanguageChange={setLanguage} onBack={() => setScreen(connection?.role === "participant" && connection.eventId ? { name: "participant-expense", eventId: connection.eventId } : { name: "participant-home" })} onSubmit={(code) => authenticateAdmin(code, screen.bootstrap)} />;
  if (screen.name === "settings" && connection?.role === "owner") return <SettingsScreen settings={data.settings} language={language} onLanguageChange={setLanguage} onChange={saveSettings} onChangeAdminCode={changeAdminCode} onBack={() => setScreen({ name: "admin-home" })} />;
  if (screen.name === "families" && primaryGroup && connection?.role === "owner") return <GroupWorkspace group={primaryGroup} units={repositoryFamilies} members={data.members} events={data.events} language={language} onLanguageChange={setLanguage} onBack={() => setScreen({ name: "admin-home" })} onAddUnit={(name) => { const family = { id: createId(), groupId: primaryGroup.id, name, order: repositoryFamilies.length }; setData((current) => ({ ...current, billingUnits: [...current.billingUnits, family] })); void runCloud(saveCloudUnit(family)).catch(() => undefined); }} onRenameUnit={(id, name) => { const family = data.billingUnits.find((item) => item.id === id); if (!family) return; const updated = { ...family, name }; setData((current) => ({ ...current, billingUnits: current.billingUnits.map((item) => item.id === id ? updated : item) })); void runCloud(saveCloudUnit(updated)).catch(() => undefined); }} onDeleteUnit={(id) => { if (data.events.some((event) => event.familyIds.includes(id))) return; setData((current) => ({ ...current, billingUnits: current.billingUnits.filter((unit) => unit.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) })); void runCloud(deleteCloudUnit(id)).catch(() => undefined); }} onAddMember={(familyId, details) => { const member = { ...details, id: createId(), billingUnitId: familyId, order: data.members.filter((item) => item.billingUnitId === familyId).length }; setData((current) => ({ ...current, members: [...current.members, member] })); void runCloud(saveCloudMember(primaryGroup.id, member)).catch(() => undefined); }} onUpdateMember={(id, details) => { const member = data.members.find((item) => item.id === id); if (!member) return; const updated = { ...member, ...details }; setData((current) => ({ ...current, members: current.members.map((item) => item.id === id ? updated : item) })); void runCloud(saveCloudMember(primaryGroup.id, updated)).catch(() => undefined); }} onDeleteMember={(id) => { setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== id) })); void runCloud(deleteCloudMember(id)).catch(() => undefined); }} onAssignFamily={assignFamily} onCreateEventWithFamily={(familyId, name) => createEvent(name, familyId)} />;
  if (screen.name === "event" && primaryGroup && connection?.role === "owner") {
    const event = data.events.find((item) => item.id === screen.eventId);
    if (event) return <EventScreen key={event.id} group={primaryGroup} repositoryFamilies={repositoryFamilies} repositoryMembers={data.members} settings={data.settings} language={language} draft={event} cloudStatus={cloudStatus} cloudMessage={cloudMessage} onLanguageChange={setLanguage} onSave={saveEvent} onShare={createShareLink} onCreateFamily={createFamily} onBack={() => setScreen({ name: "admin-home" })} onEditGroup={() => setScreen({ name: "families" })} />;
  }
  if (screen.name === "participant-expense") {
    const event = participantEvents.find((item) => item.id === screen.eventId);
    if (event) return <ParticipantExpense event={event} families={repositoryFamilies} members={data.members} settings={data.settings} language={language} onLanguageChange={setLanguage} onBack={() => setScreen({ name: "participant-home" })} onManage={() => { void openAdminAccess(); }} onSubmit={(expense) => submitParticipantExpense(event.id, expense)} onUpdate={updateParticipantExpense} />;
    return participantHome;
  }
  if (screen.name === "participant-home" || connection?.role !== "owner" || !primaryGroup) return participantHome;

  return <GroupHome events={[...data.events].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))} families={repositoryFamilies} cloudStatus={cloudStatus} cloudMessage={cloudMessage} language={language} onLanguageChange={setLanguage} onCreate={createEvent} onUpdate={(id, name) => { const event = data.events.find((item) => item.id === id); if (event) saveEvent({ ...event, name, updatedAt: new Date().toISOString() }); }} onDelete={(id) => { setData((current) => ({ ...current, events: current.events.filter((item) => item.id !== id) })); void runCloud(deleteCloudEvent(id)).catch(() => undefined); }} onStart={(eventId) => setScreen({ name: "event", eventId })} onFamilies={() => setScreen({ name: "families" })} onSettings={() => setScreen({ name: "settings" })} onParticipantHome={() => setScreen({ name: "participant-home" })} />;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { GatheringScreen } from "./components/gathering/GatheringScreen";
import { GroupHome } from "./components/groups/GroupHome";
import { GroupWorkspace } from "./components/groups/GroupWorkspace";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import type { CloudGroupSnapshot } from "./cloud/repository";
import { clearCloudDraft, createSharedGroup, deleteCloudGroup, deleteCloudMember, deleteCloudUnit, invitationUrl, joinSharedGroup, loadCloudGroup, saveCloudDraft, saveCloudGroup, saveCloudMember, saveCloudUnit, subscribeToCloudGroup } from "./cloud/repository";
import type { GatheringDraft, PersistentData } from "./domain/models";
import { createId } from "./utils/id";
import { localAppStorage } from "./storage/localStorage";
import { usePersistentData } from "./hooks/usePersistentData";

type Screen = { name: "home" } | { name: "manage"; groupId: string; returnToGathering?: boolean } | { name: "gathering"; groupId: string } | { name: "settings" };
type CloudStatus = "idle" | "syncing" | "synced" | "error";

const mergeSnapshot = (current: PersistentData, snapshot: CloudGroupSnapshot): PersistentData => {
  const previousUnitIds = new Set(current.billingUnits.filter((unit) => unit.groupId === snapshot.group.id).map((unit) => unit.id));
  return {
    ...current,
    groups: [...current.groups.filter((group) => group.id !== snapshot.group.id), snapshot.group],
    billingUnits: [...current.billingUnits.filter((unit) => unit.groupId !== snapshot.group.id), ...snapshot.units],
    members: [...current.members.filter((member) => !previousUnitIds.has(member.billingUnitId)), ...snapshot.members],
    gatheringDrafts: [...current.gatheringDrafts.filter((draft) => draft.groupId !== snapshot.group.id), ...(snapshot.draft ? [snapshot.draft] : [])],
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
      setCloudStatus("synced"); setCloudMessage(language === "he" ? "הצטרפתם למשפחה המשותפת" : "Joined the shared group");
    }).catch(() => { setCloudStatus("error"); setCloudMessage(language === "he" ? "קישור ההצטרפות אינו תקין או שפג תוקפו" : "The invitation is invalid or expired"); });
  }, [language, setData]);

  useEffect(() => {
    const groupIds = sharedGroupIds.split("|").filter(Boolean);
    if (!groupIds.length) return;
    let timer: number | undefined;
    const refresh = (groupId: string) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void loadCloudGroup(groupId).then((snapshot) => { setData((current) => mergeSnapshot(current, snapshot)); setCloudStatus("synced"); }).catch(() => setCloudStatus("error")); }, 250);
    };
    const unsubscribers = groupIds.map((groupId) => subscribeToCloudGroup(groupId, () => refresh(groupId)));
    void Promise.all(groupIds.map((groupId) => loadCloudGroup(groupId))).then((snapshots) => setData((current) => snapshots.reduce(mergeSnapshot, current))).catch(() => setCloudStatus("error"));
    return () => { window.clearTimeout(timer); unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, [sharedGroupIds, setData]);

  const runCloud = (operation: Promise<unknown>) => {
    setCloudStatus("syncing");
    void operation.then(() => setCloudStatus("synced")).catch(() => { setCloudStatus("error"); setCloudMessage(language === "he" ? "השינוי נשמר במכשיר, אך הסנכרון נכשל" : "Saved locally, but sync failed"); });
  };
  const setLanguage = (next: typeof language) => setData((current) => ({ ...current, settings: { ...current.settings, language: next } }));
  const saveDraft = (draft: GatheringDraft) => {
    const previous = data.gatheringDrafts.find((item) => item.groupId === draft.groupId);
    setData((current) => ({ ...current, gatheringDrafts: [...current.gatheringDrafts.filter((item) => item.groupId !== draft.groupId), draft] }));
    if (shared(draft.groupId)) runCloud(saveCloudDraft(draft.groupId, draft, previous));
  };
  const clearDraft = (groupId: string) => { setData((current) => ({ ...current, gatheringDrafts: current.gatheringDrafts.filter((item) => item.groupId !== groupId) })); if (shared(groupId)) runCloud(clearCloudDraft(groupId)); };
  const shareGroup = async (groupId: string) => {
    try {
      setCloudStatus("syncing");
      let connection = data.sharedGroups.find((item) => item.groupId === groupId);
      if (!connection) {
        const inviteToken = await createSharedGroup(data, groupId);
        connection = { groupId, inviteToken, role: "owner" };
        setData((current) => ({ ...current, sharedGroups: [...current.sharedGroups, connection!] }));
      }
      if (!connection.inviteToken) { setCloudMessage(language === "he" ? "המשפחה משותפת. רק הבעלים יכול להפיץ קישור." : "This group is shared. Only the owner can share its link."); setCloudStatus("synced"); return; }
      const url = invitationUrl(connection.inviteToken);
      if (navigator.share) await navigator.share({ title: data.groups.find((group) => group.id === groupId)?.name, url });
      else await navigator.clipboard.writeText(url);
      setCloudMessage(language === "he" ? "קישור השיתוף מוכן" : "Share link ready"); setCloudStatus("synced");
    } catch { setCloudStatus("error"); setCloudMessage(language === "he" ? "לא הצלחנו להפעיל שיתוף כרגע" : "Could not enable sharing"); }
  };

  if (screen.name === "settings") return <SettingsScreen settings={data.settings} language={language} onLanguageChange={setLanguage} onChange={(settings) => setData((current) => ({ ...current, settings }))} onBack={() => setScreen({ name: "home" })} />;

  if (screen.name === "manage" || screen.name === "gathering") {
    const group = data.groups.find((item) => item.id === screen.groupId);
    const returnToGathering = screen.name === "manage" && screen.returnToGathering;
    if (group && screen.name === "gathering") return <GatheringScreen group={group} units={data.billingUnits.filter((unit) => unit.groupId === group.id)} members={data.members} settings={data.settings} language={language} draft={data.gatheringDrafts.find((item) => item.groupId === group.id)} onLanguageChange={setLanguage} onSave={saveDraft} onClear={() => clearDraft(group.id)} onBack={() => setScreen({ name: "home" })} onEditGroup={() => setScreen({ name: "manage", groupId: group.id, returnToGathering: true })} />;
    if (group) return <GroupWorkspace
      group={group} units={data.billingUnits.filter((unit) => unit.groupId === group.id)} members={data.members} language={language} returnToGathering={returnToGathering} onLanguageChange={setLanguage}
      onBack={() => setScreen(returnToGathering ? { name: "gathering", groupId: group.id } : { name: "home" })}
      onAddUnit={(name) => { const unit = { id: createId(), groupId: group.id, name, order: data.billingUnits.filter((item) => item.groupId === group.id).length }; setData((current) => ({ ...current, billingUnits: [...current.billingUnits, unit] })); if (shared(group.id)) runCloud(saveCloudUnit(unit)); }}
      onRenameUnit={(id, name) => { const unit = data.billingUnits.find((item) => item.id === id); if (!unit) return; const updated = { ...unit, name }; setData((current) => ({ ...current, billingUnits: current.billingUnits.map((item) => item.id === id ? updated : item) })); if (shared(group.id)) runCloud(saveCloudUnit(updated)); }}
      onDeleteUnit={(id) => { setData((current) => ({ ...current, billingUnits: current.billingUnits.filter((unit) => unit.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) })); if (shared(group.id)) runCloud(deleteCloudUnit(id)); }}
      onAddMember={(unitId, details) => { const member = { ...details, id: createId(), billingUnitId: unitId, order: data.members.filter((item) => item.billingUnitId === unitId).length }; setData((current) => ({ ...current, members: [...current.members, member] })); if (shared(group.id)) runCloud(saveCloudMember(group.id, member)); }}
      onUpdateMember={(id, details) => { const member = data.members.find((item) => item.id === id); if (!member) return; const updated = { ...member, ...details }; setData((current) => ({ ...current, members: current.members.map((item) => item.id === id ? updated : item) })); if (shared(group.id)) runCloud(saveCloudMember(group.id, updated)); }}
      onDeleteMember={(id) => { setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== id) })); if (shared(group.id)) runCloud(deleteCloudMember(id)); }}
      onStartGathering={() => setScreen({ name: "gathering", groupId: group.id })}
    />;
  }

  return <GroupHome
    groups={data.groups} drafts={data.gatheringDrafts} sharedGroups={data.sharedGroups} cloudStatus={cloudStatus} cloudMessage={cloudMessage} language={language} onLanguageChange={setLanguage}
    onCreate={(name) => setData((current) => ({ ...current, groups: [...current.groups, { id: createId(), name }] }))}
    onRename={(id, name) => { const group = data.groups.find((item) => item.id === id); if (!group) return; const updated = { ...group, name }; setData((current) => ({ ...current, groups: current.groups.map((item) => item.id === id ? updated : item) })); if (shared(id)) runCloud(saveCloudGroup(updated)); }}
    onDelete={(id) => { const unitIds = new Set(data.billingUnits.filter((unit) => unit.groupId === id).map((unit) => unit.id)); setData((current) => ({ ...current, groups: current.groups.filter((group) => group.id !== id), billingUnits: current.billingUnits.filter((unit) => unit.groupId !== id), members: current.members.filter((member) => !unitIds.has(member.billingUnitId)), gatheringDrafts: current.gatheringDrafts.filter((draft) => draft.groupId !== id), sharedGroups: current.sharedGroups.filter((item) => item.groupId !== id) })); if (shared(id)) runCloud(deleteCloudGroup(id)); }}
    onStart={(groupId) => setScreen({ name: "gathering", groupId })} onManage={(groupId) => setScreen({ name: "manage", groupId })} onShare={(groupId) => { void shareGroup(groupId); }} onSettings={() => setScreen({ name: "settings" })}
  />;
}

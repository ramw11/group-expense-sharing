import { useEffect, useState } from "react";
import { GatheringScreen } from "./components/gathering/GatheringScreen";
import { GroupHome } from "./components/groups/GroupHome";
import { GroupWorkspace } from "./components/groups/GroupWorkspace";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { createId } from "./utils/id";
import { localAppStorage } from "./storage/localStorage";
import { usePersistentData } from "./hooks/usePersistentData";

type Screen = { name: "home" } | { name: "manage" | "gathering"; groupId: string } | { name: "settings" };

export default function App() {
  const [data, setData] = usePersistentData(localAppStorage);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const language = data.settings.language;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = (next: typeof language) => setData((current) => ({ ...current, settings: { ...current.settings, language: next } }));

  if (screen.name === "settings") return <SettingsScreen settings={data.settings} language={language} onLanguageChange={setLanguage} onChange={(settings) => setData((current) => ({ ...current, settings }))} onBack={() => setScreen({ name: "home" })} />;

  if (screen.name === "manage" || screen.name === "gathering") {
    const group = data.groups.find((item) => item.id === screen.groupId);
    if (group && screen.name === "gathering") return <GatheringScreen group={group} units={data.billingUnits.filter((unit) => unit.groupId === group.id)} members={data.members} settings={data.settings} language={language} onLanguageChange={setLanguage} onBack={() => setScreen({ name: "home" })} />;
    if (group) return <GroupWorkspace
      group={group}
      units={data.billingUnits.filter((unit) => unit.groupId === group.id)}
      members={data.members}
      language={language}
      onLanguageChange={setLanguage}
      onBack={() => setScreen({ name: "home" })}
      onAddUnit={(name) => setData((current) => ({ ...current, billingUnits: [...current.billingUnits, { id: createId(), groupId: group.id, name, order: current.billingUnits.filter((unit) => unit.groupId === group.id).length }] }))}
      onRenameUnit={(id, name) => setData((current) => ({ ...current, billingUnits: current.billingUnits.map((unit) => unit.id === id ? { ...unit, name } : unit) }))}
      onDeleteUnit={(id) => setData((current) => ({ ...current, billingUnits: current.billingUnits.filter((unit) => unit.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) }))}
      onAddMember={(unitId, member) => setData((current) => ({ ...current, members: [...current.members, { ...member, id: createId(), billingUnitId: unitId, order: current.members.filter((item) => item.billingUnitId === unitId).length }] }))}
      onUpdateMember={(id, member) => setData((current) => ({ ...current, members: current.members.map((item) => item.id === id ? { ...item, ...member } : item) }))}
      onDeleteMember={(id) => setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== id) }))}
      onStartGathering={() => setScreen({ name: "gathering", groupId: group.id })}
    />;
  }

  return <GroupHome
    groups={data.groups}
    language={language}
    onLanguageChange={setLanguage}
    onCreate={(name) => setData((current) => ({ ...current, groups: [...current.groups, { id: createId(), name }] }))}
    onRename={(id, name) => setData((current) => ({ ...current, groups: current.groups.map((group) => group.id === id ? { ...group, name } : group) }))}
    onDelete={(id) => setData((current) => {
      const unitIds = new Set(current.billingUnits.filter((unit) => unit.groupId === id).map((unit) => unit.id));
      return { ...current, groups: current.groups.filter((group) => group.id !== id), billingUnits: current.billingUnits.filter((unit) => unit.groupId !== id), members: current.members.filter((member) => !unitIds.has(member.billingUnitId)) };
    })}
    onStart={(groupId) => setScreen({ name: "gathering", groupId })}
    onManage={(groupId) => setScreen({ name: "manage", groupId })}
    onSettings={() => setScreen({ name: "settings" })}
  />;
}

import { useState } from "react";
import { GatheringScreen } from "./components/gathering/GatheringScreen";
import { GroupHome } from "./components/groups/GroupHome";
import { GroupWorkspace } from "./components/groups/GroupWorkspace";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { createId } from "./utils/id";
import { localAppStorage } from "./storage/localStorage";
import { usePersistentData } from "./hooks/usePersistentData";

export default function App() {
  const [data, setData] = usePersistentData(localAppStorage);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [inGathering, setInGathering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) return <SettingsScreen settings={data.settings} onChange={(settings) => setData((current) => ({ ...current, settings }))} onBack={() => setShowSettings(false)} />;

  if (selectedGroupId) {
    const group = data.groups.find((item) => item.id === selectedGroupId);
    if (group && inGathering) return <GatheringScreen group={group} units={data.billingUnits.filter((unit) => unit.groupId === group.id)} members={data.members} settings={data.settings} onBack={() => setInGathering(false)} />;
    if (group) return <GroupWorkspace
      group={group}
      units={data.billingUnits.filter((unit) => unit.groupId === group.id)}
      members={data.members}
      onBack={() => setSelectedGroupId(null)}
      onAddUnit={(name) => setData((current) => ({ ...current, billingUnits: [...current.billingUnits, { id: createId(), groupId: group.id, name, order: current.billingUnits.filter((unit) => unit.groupId === group.id).length }] }))}
      onRenameUnit={(id, name) => setData((current) => ({ ...current, billingUnits: current.billingUnits.map((unit) => unit.id === id ? { ...unit, name } : unit) }))}
      onDeleteUnit={(id) => setData((current) => ({ ...current, billingUnits: current.billingUnits.filter((unit) => unit.id !== id), members: current.members.filter((member) => member.billingUnitId !== id) }))}
      onAddMember={(unitId, member) => setData((current) => ({ ...current, members: [...current.members, { ...member, id: createId(), billingUnitId: unitId, order: current.members.filter((item) => item.billingUnitId === unitId).length }] }))}
      onUpdateMember={(id, member) => setData((current) => ({ ...current, members: current.members.map((item) => item.id === id ? { ...item, ...member } : item) }))}
      onDeleteMember={(id) => setData((current) => ({ ...current, members: current.members.filter((member) => member.id !== id) }))}
      onStartGathering={() => setInGathering(true)}
    />;
  }

  return (
    <GroupHome
      groups={data.groups}
      onCreate={(name) => setData((current) => ({ ...current, groups: [...current.groups, { id: createId(), name }] }))}
      onRename={(id, name) => setData((current) => ({ ...current, groups: current.groups.map((group) => group.id === id ? { ...group, name } : group) }))}
      onDelete={(id) => setData((current) => {
        const unitIds = new Set(current.billingUnits.filter((unit) => unit.groupId === id).map((unit) => unit.id));
        return { ...current, groups: current.groups.filter((group) => group.id !== id), billingUnits: current.billingUnits.filter((unit) => unit.groupId !== id), members: current.members.filter((member) => !unitIds.has(member.billingUnitId)) };
      })}
      onOpen={(id) => { setSelectedGroupId(id); setInGathering(false); }}
      onSettings={() => setShowSettings(true)}
    />
  );
}

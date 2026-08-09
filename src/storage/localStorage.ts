import { calculationSettingsFrom, defaultSettings } from "../domain/defaults";
import type { BillingUnit, Event, Language, Member, PersistentData } from "../domain/models";

const LEGACY_STORAGE_KEY = "group-expense-sharing:v1";
const PREFERENCES_KEY = "group-expense-sharing:preferences";

export interface DevicePreferences {
  version: 1;
  language: Language;
  activeGroupId?: string;
  participantEventId?: string;
}

type LegacyData = {
  version: 1 | 2 | 3 | 4 | 5;
  groups: PersistentData["groups"];
  billingUnits: BillingUnit[];
  members: Member[];
  gatheringDrafts?: Array<Partial<Event> & { groupId: string; families?: Array<{ id: string }> }>;
  sharedGroups?: Array<{ groupId: string; role: string }>;
  settings: PersistentData["settings"];
};

const isLegacyData = (value: unknown): value is LegacyData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<LegacyData>;
  return [1, 2, 3, 4, 5].includes(data.version ?? 0)
    && Array.isArray(data.groups)
    && Array.isArray(data.billingUnits)
    && Array.isArray(data.members)
    && Boolean(data.settings);
};

const normalizedName = (name: string) => name.trim().replace(/[\u05F4"]/g, "״").replace(/\s+/g, " ");

const canonicalFamilies = (units: BillingUnit[], members: Member[], eventNames: Set<string>, groupId: string) => {
  const memberCount = (id: string) => members.filter((member) => member.billingUnitId === id).length;
  const byName = new Map<string, BillingUnit[]>();
  for (const unit of units) byName.set(normalizedName(unit.name), [...(byName.get(normalizedName(unit.name)) ?? []), unit]);

  const idMap = new Map<string, string>();
  const families: BillingUnit[] = [];
  for (const [name, candidates] of byName) {
    const ranked = [...candidates].sort((a, b) => memberCount(b.id) - memberCount(a.id) || a.order - b.order);
    const canonical = ranked[0];
    if (eventNames.has(name) && ranked.every((unit) => memberCount(unit.id) === 0)) continue;
    for (const candidate of ranked) idMap.set(candidate.id, canonical.id);
    families.push({ ...canonical, groupId, name });
  }
  families.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return { families: families.map((family, order) => ({ ...family, order })), idMap };
};

export const loadLegacyBusinessData = (): PersistentData | undefined => {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isLegacyData(parsed)) return undefined;
    const group = parsed.groups.find((item) => item.id === parsed.sharedGroups?.find((connection) => connection.role === "owner")?.groupId)
      ?? parsed.groups[0];
    if (!group) return undefined;
    const drafts = parsed.gatheringDrafts ?? [];
    const eventNames = new Set(drafts.map((event) => normalizedName(event.name?.trim() || "אירוע שמור")));
    const { families, idMap } = canonicalFamilies(parsed.billingUnits, parsed.members, eventNames, group.id);
    const validFamilyIds = new Set(families.map((family) => family.id));
    const members = parsed.members
      .map((member) => ({ ...member, billingUnitId: idMap.get(member.billingUnitId) ?? member.billingUnitId }))
      .filter((member) => validFamilyIds.has(member.billingUnitId));
    const settings = { ...defaultSettings, ...parsed.settings };
    const events: Event[] = drafts.map((event, index) => {
      const sourceFamilyIds = Array.isArray(event.familyIds)
        ? event.familyIds
        : Array.isArray(event.families)
          ? event.families.map((family) => family.id)
          : parsed.billingUnits.filter((family) => family.groupId === event.groupId).map((family) => family.id);
      const attendance = Array.isArray(event.attendance) ? event.attendance : [];
      const expenses = Array.isArray(event.expenses) ? event.expenses : [];
      const inferredFamilyIds = [
        ...members.filter((member) => attendance.some((item) => item.memberId === member.id)).map((member) => member.billingUnitId),
        ...expenses.map((expense) => idMap.get(expense.billingUnitId) ?? expense.billingUnitId),
      ];
      const familyIds = [...new Set([...sourceFamilyIds, ...inferredFamilyIds].map((id) => idMap.get(id) ?? id).filter((id) => validFamilyIds.has(id)))];
      const validMemberIds = new Set(members.filter((member) => familyIds.includes(member.billingUnitId)).map((member) => member.id));
      return {
        id: event.id ?? `event-${group.id}-${index}`,
        groupId: group.id,
        name: event.name?.trim() || "אירוע שמור",
        date: event.date ?? new Date().toISOString().slice(0, 10),
        familyIds,
        attendance: attendance.filter((item) => validMemberIds.has(item.memberId)),
        expenses: expenses
          .map((expense) => ({ ...expense, billingUnitId: idMap.get(expense.billingUnitId) ?? expense.billingUnitId }))
          .filter((expense) => familyIds.includes(expense.billingUnitId)),
        calculationSettings: event.calculationSettings ?? calculationSettingsFrom(settings),
        updatedAt: event.updatedAt ?? new Date().toISOString(),
      };
    });
    return { version: 6, groups: [group], billingUnits: families, members, events, settings };
  } catch {
    return undefined;
  }
};

export const loadDevicePreferences = (): DevicePreferences => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null") as Partial<DevicePreferences> | null;
    if (parsed?.version === 1 && (parsed.language === "he" || parsed.language === "en")) return { version: 1, language: parsed.language, activeGroupId: parsed.activeGroupId, participantEventId: parsed.participantEventId };
  } catch {
    // Fall through to the legacy language preference.
  }
  const legacy = loadLegacyBusinessData();
  return { version: 1, language: legacy?.settings.language ?? "he" };
};

export const saveDevicePreferences = (preferences: DevicePreferences) => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

export const discardLegacyBusinessData = () => {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
};

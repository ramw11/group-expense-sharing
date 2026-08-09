import { defaultSettings, emptyPersistentData } from "../domain/defaults";
import type { BillingUnit, GatheringDraft, Member, PersistentData } from "../domain/models";
import type { AppStorage } from "./storage";

const STORAGE_KEY = "group-expense-sharing:v1";
const HEBREW_DEFAULT_MIGRATION_KEY = "group-expense-sharing:he-default-applied";

type StoredData = Omit<PersistentData, "version" | "gatheringDrafts"> & {
  version: 1 | 2 | 3 | 4 | 5;
  gatheringDrafts?: Array<Partial<GatheringDraft> & { groupId: string; families?: Array<{ id: string }> }>;
};

const isStoredData = (value: unknown): value is StoredData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StoredData>;
  return [1, 2, 3, 4, 5].includes(data.version ?? 0) && Array.isArray(data.groups) && Array.isArray(data.billingUnits) && Array.isArray(data.members) && !!data.settings;
};

const normalizedName = (name: string) => name.trim().replace(/[\u05F4"]/g, "״").replace(/\s+/g, " ");

const preferredGroup = (data: StoredData, fallback: PersistentData) => {
  const connectedId = data.sharedGroups?.find((connection) => data.groups.some((group) => group.id === connection.groupId))?.groupId;
  return data.groups.find((group) => group.id === connectedId)
    ?? data.groups.find((group) => group.id === fallback.groups[0].id)
    ?? data.groups[0]
    ?? fallback.groups[0];
};

const canonicalFamilies = (units: BillingUnit[], members: Member[], eventNames: Set<string>, groupId: string) => {
  const memberCount = (id: string) => members.filter((member) => member.billingUnitId === id).length;
  const byName = new Map<string, BillingUnit[]>();
  for (const unit of units) {
    const key = normalizedName(unit.name);
    const candidates = byName.get(key) ?? [];
    candidates.push(unit);
    byName.set(key, candidates);
  }

  const idMap = new Map<string, string>();
  const families: BillingUnit[] = [];
  for (const [name, candidates] of byName) {
    const ranked = [...candidates].sort((a, b) => memberCount(b.id) - memberCount(a.id) || a.order - b.order);
    const canonical = ranked[0];
    const totalMembers = ranked.reduce((sum, unit) => sum + memberCount(unit.id), 0);
    if (eventNames.has(name) && totalMembers === 0) continue;
    for (const candidate of ranked) idMap.set(candidate.id, canonical.id);
    families.push({ ...canonical, groupId, name });
  }

  families.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return { families: families.map((family, order) => ({ ...family, order })), idMap };
};

const migrate = (data: StoredData): PersistentData => {
  const fallback = emptyPersistentData();
  const primaryGroup = preferredGroup(data, fallback);
  const originalUnits = data.billingUnits;
  const drafts = Array.isArray(data.gatheringDrafts) ? data.gatheringDrafts : [];
  const eventNames = new Set(drafts.map((draft) => normalizedName(draft.name?.trim() || "אירוע שמור")));
  const { families: billingUnits, idMap } = canonicalFamilies(originalUnits, data.members, eventNames, primaryGroup.id);
  const validFamilyIds = new Set(billingUnits.map((family) => family.id));
  const members = data.members
    .map((member) => ({ ...member, billingUnitId: idMap.get(member.billingUnitId) ?? member.billingUnitId }))
    .filter((member) => validFamilyIds.has(member.billingUnitId));

  return {
    ...data,
    version: 5,
    groups: [primaryGroup],
    billingUnits,
    gatheringDrafts: drafts.map((draft, index) => {
      const existingFamilyIds = Array.isArray(draft.familyIds) ? draft.familyIds : Array.isArray(draft.families) ? draft.families.map((family) => family.id) : undefined;
      const sourceIds = originalUnits.filter((unit) => unit.groupId === draft.groupId).map((unit) => unit.id);
      const attendance = Array.isArray(draft.attendance) ? draft.attendance : [];
      const expenses = Array.isArray(draft.expenses) ? draft.expenses : [];
      const attendanceMemberIds = new Set(attendance.map((item) => item.memberId));
      const inferredIds = [
        ...members.filter((member) => attendanceMemberIds.has(member.id)).map((member) => member.billingUnitId),
        ...expenses.map((expense) => idMap.get(expense.billingUnitId) ?? expense.billingUnitId),
      ];
      const familyIds = [...new Set([...(existingFamilyIds ?? sourceIds), ...inferredIds].map((id) => idMap.get(id) ?? id).filter((id) => validFamilyIds.has(id)))];
      const memberIds = new Set(members.filter((member) => familyIds.includes(member.billingUnitId)).map((member) => member.id));
      return {
        id: draft.id ?? `event-${draft.groupId}-${index}`,
        groupId: primaryGroup.id,
        name: draft.name?.trim() || "אירוע שמור",
        date: draft.date ?? new Date().toISOString().slice(0, 10),
        familyIds,
        attendance: attendance.filter((item) => memberIds.has(item.memberId)),
        expenses: expenses.map((expense) => ({ ...expense, billingUnitId: idMap.get(expense.billingUnitId) ?? expense.billingUnitId })).filter((expense) => familyIds.includes(expense.billingUnitId)),
        updatedAt: draft.updatedAt ?? new Date().toISOString(),
      };
    }),
    members,
    sharedGroups: Array.isArray(data.sharedGroups) ? data.sharedGroups.filter((connection) => connection.groupId === primaryGroup.id).map((connection) => ({ ...connection, role: connection.role === "owner" ? "owner" as const : "participant" as const })) : [],
    settings: { ...defaultSettings, ...data.settings },
  };
};

export const localAppStorage: AppStorage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyPersistentData();
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredData(parsed)) return emptyPersistentData();
      const migrated = migrate(parsed);
      if (!localStorage.getItem(HEBREW_DEFAULT_MIGRATION_KEY)) {
        localStorage.setItem(HEBREW_DEFAULT_MIGRATION_KEY, "true");
        migrated.settings.language = "he";
      }
      return migrated;
    } catch {
      return emptyPersistentData();
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};

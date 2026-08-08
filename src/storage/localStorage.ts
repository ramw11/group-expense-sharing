import { defaultSettings, emptyPersistentData } from "../domain/defaults";
import type { GatheringDraft, PersistentData } from "../domain/models";
import type { AppStorage } from "./storage";

const STORAGE_KEY = "group-expense-sharing:v1";
const HEBREW_DEFAULT_MIGRATION_KEY = "group-expense-sharing:he-default-applied";

type StoredData = Omit<PersistentData, "version" | "gatheringDrafts"> & {
  version: 1 | 2 | 3 | 4;
  gatheringDrafts?: Array<Partial<GatheringDraft> & { groupId: string; families?: Array<{ id: string }> }>;
};

const isStoredData = (value: unknown): value is StoredData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StoredData>;
  return (data.version === 1 || data.version === 2 || data.version === 3 || data.version === 4) && Array.isArray(data.groups) && Array.isArray(data.billingUnits) && Array.isArray(data.members) && !!data.settings;
};

const migrate = (data: StoredData): PersistentData => {
  const fallback = emptyPersistentData();
  const primaryGroup = data.groups[0] ?? fallback.groups[0];
  const originalUnits = data.billingUnits;
  const emptyGroups = data.groups.filter((group) => group.id !== primaryGroup.id && !originalUnits.some((unit) => unit.groupId === group.id));
  const derivedUnits = emptyGroups.map((group, index) => ({ id: `family-${group.id}`, groupId: primaryGroup.id, name: group.name, order: originalUnits.length + index }));
  const billingUnits = [...originalUnits.map((unit) => ({ ...unit, groupId: primaryGroup.id })), ...derivedUnits];
  const drafts = Array.isArray(data.gatheringDrafts) ? data.gatheringDrafts : [];

  return {
    ...data,
    version: 4,
    groups: [primaryGroup],
    billingUnits,
    gatheringDrafts: drafts.map((draft, index) => {
      const existingFamilyIds = Array.isArray(draft.familyIds) ? draft.familyIds : Array.isArray(draft.families) ? draft.families.map((family) => family.id) : undefined;
      const sourceIds = originalUnits.filter((unit) => unit.groupId === draft.groupId).map((unit) => unit.id);
      const emptyGroupFamily = derivedUnits.find((unit) => unit.id === `family-${draft.groupId}`);
      const familyIds = existingFamilyIds ?? (sourceIds.length ? sourceIds : emptyGroupFamily ? [emptyGroupFamily.id] : []);
      const memberIds = new Set(data.members.filter((member) => familyIds.includes(member.billingUnitId)).map((member) => member.id));
      return {
        id: draft.id ?? `event-${draft.groupId}-${index}`,
        groupId: primaryGroup.id,
        name: draft.name?.trim() || "אירוע שמור",
        date: draft.date ?? new Date().toISOString().slice(0, 10),
        familyIds,
        attendance: Array.isArray(draft.attendance) ? draft.attendance.filter((item) => memberIds.has(item.memberId)) : [],
        expenses: Array.isArray(draft.expenses) ? draft.expenses.filter((expense) => familyIds.includes(expense.billingUnitId)) : [],
        updatedAt: draft.updatedAt ?? new Date().toISOString(),
      };
    }),
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

import { defaultSettings, emptyPersistentData } from "../domain/defaults";
import type { GatheringDraft, PersistentData } from "../domain/models";
import type { AppStorage } from "./storage";

const STORAGE_KEY = "group-expense-sharing:v1";
const HEBREW_DEFAULT_MIGRATION_KEY = "group-expense-sharing:he-default-applied";

type StoredData = Omit<PersistentData, "version" | "gatheringDrafts"> & {
  version: 1 | 2;
  gatheringDrafts?: Array<Partial<GatheringDraft> & { groupId: string }>;
};

const isStoredData = (value: unknown): value is StoredData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StoredData>;
  return (data.version === 1 || data.version === 2) && Array.isArray(data.groups) && Array.isArray(data.billingUnits) && Array.isArray(data.members) && !!data.settings;
};

export const localAppStorage: AppStorage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyPersistentData();
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredData(parsed)) return emptyPersistentData();
      const drafts = Array.isArray(parsed.gatheringDrafts) ? parsed.gatheringDrafts : [];
      const migrated: PersistentData = {
        ...parsed,
        version: 2,
        gatheringDrafts: drafts.map((draft, index) => ({
          id: draft.id ?? `event-${draft.groupId}-${index}`,
          groupId: draft.groupId,
          name: draft.name?.trim() || "אירוע שמור",
          date: draft.date ?? new Date().toISOString().slice(0, 10),
          attendance: Array.isArray(draft.attendance) ? draft.attendance : [],
          expenses: Array.isArray(draft.expenses) ? draft.expenses : [],
          updatedAt: draft.updatedAt ?? new Date().toISOString(),
        })),
        sharedGroups: Array.isArray(parsed.sharedGroups) ? parsed.sharedGroups : [],
        settings: { ...defaultSettings, ...parsed.settings },
      };
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

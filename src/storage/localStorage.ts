import { defaultSettings, emptyPersistentData } from "../domain/defaults";
import type { PersistentData } from "../domain/models";
import type { AppStorage } from "./storage";

const STORAGE_KEY = "group-expense-sharing:v1";
const HEBREW_DEFAULT_MIGRATION_KEY = "group-expense-sharing:he-default-applied";

const isPersistentData = (value: unknown): value is PersistentData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PersistentData>;
  return data.version === 1 && Array.isArray(data.groups) && Array.isArray(data.billingUnits) && Array.isArray(data.members) && !!data.settings;
};

export const localAppStorage: AppStorage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyPersistentData();
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistentData(parsed)) return emptyPersistentData();
      const migrated = { ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
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

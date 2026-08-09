import type { PersistentData, Settings } from "./models";

export const defaultSettings: Settings = {
  language: "he",
  currency: "ILS",
  childAgeThreshold: 12,
  childWeight: 0.5,
  weightMode: "automatic",
  roundingMode: "nearest-0.5",
  reportFooter: "תודה לכולם!",
};

export const emptyPersistentData = (): PersistentData => ({
  version: 5,
  groups: [{ id: "group-local", name: "הקבוצה שלי" }],
  billingUnits: [],
  members: [],
  gatheringDrafts: [],
  sharedGroups: [],
  settings: { ...defaultSettings },
});

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
  version: 6,
  groups: [],
  billingUnits: [],
  members: [],
  events: [],
  settings: { ...defaultSettings },
});

export const calculationSettingsFrom = (settings: Settings) => ({
  childAgeThreshold: settings.childAgeThreshold,
  childWeight: settings.childWeight,
  weightMode: settings.weightMode,
  roundingMode: settings.roundingMode,
});

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
  version: 3,
  groups: [{ id: "group-warhaftig", name: "משפחת ורהפטיג" }],
  billingUnits: [
    { id: "unit-nitzan", groupId: "group-warhaftig", name: "ורהפטיג ניצן", order: 0 },
    { id: "unit-yad-binyamin", groupId: "group-warhaftig", name: "ורהפטיג יד״ב", order: 1 },
  ],
  members: [
    ...["מוטי", "יפעת", "הודיה", "מנחם", "הלל", "אלירז", "ארז", "רוני", "אריאל", "אוריה"].map((name, order) => ({ id: `member-nitzan-${order}`, billingUnitId: "unit-nitzan", name, active: true, order })),
    ...["רמי", "עדינה", "כפיר", "שני", "זהר", "אור", "שירה", "שי"].map((name, order) => ({ id: `member-yad-binyamin-${order}`, billingUnitId: "unit-yad-binyamin", name, active: true, order })),
  ],
  gatheringDrafts: [],
  sharedGroups: [],
  settings: { ...defaultSettings },
});

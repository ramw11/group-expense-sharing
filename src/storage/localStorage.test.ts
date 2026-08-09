import { beforeEach, describe, expect, it, vi } from "vitest";
import { localAppStorage } from "./localStorage";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});

describe("local storage migration", () => {
  it("keeps an existing v1 event while separating its id from the family", () => {
    values.set("group-expense-sharing:v1", JSON.stringify({
      version: 1,
      groups: [{ id: "family-1", name: "משפחה" }],
      billingUnits: [{ id: "family-a", groupId: "family-1", name: "משפחה א", order: 0 }],
      members: [{ id: "member-a", billingUnitId: "family-a", name: "חבר א", active: true, order: 0 }],
      gatheringDrafts: [{ groupId: "family-1", name: "אירוע קיץ", date: "2026-08-01", attendance: [{ memberId: "member-a", present: true }], expenses: [], updatedAt: "2026-08-01T00:00:00.000Z" }],
      sharedGroups: [{ groupId: "family-1", role: "editor" }],
      settings: { language: "he", currency: "ILS", childAgeThreshold: 12, childWeight: 0.5, weightMode: "automatic", roundingMode: "nearest-0.5", reportFooter: "" },
    }));

    const migrated = localAppStorage.load();

    expect(migrated.version).toBe(5);
    expect(migrated.groups[0].name).toBe("משפחה");
    expect(migrated.gatheringDrafts[0]).toMatchObject({ id: "event-family-1-0", groupId: "family-1", name: "אירוע קיץ" });
    expect(migrated.gatheringDrafts[0].familyIds).toEqual(["family-a"]);
    expect(migrated.sharedGroups[0].role).toBe("participant");
  });

  it("removes duplicate families and event names created by the broken v4 migration", () => {
    values.set("group-expense-sharing:v1", JSON.stringify({
      version: 4,
      groups: [{ id: "group-main", name: "קבוצה" }],
      billingUnits: [
        { id: "family-a", groupId: "group-main", name: "משפחה א", order: 0 },
        { id: "family-old-a", groupId: "group-main", name: "משפחה א", order: 5 },
        { id: "family-old-event", groupId: "group-main", name: "אירוע קיץ", order: 6 },
      ],
      members: [{ id: "member-a", billingUnitId: "family-a", name: "חבר א", active: true, order: 0 }],
      gatheringDrafts: [{ id: "event-1", groupId: "group-main", name: "אירוע קיץ", date: "2026-08-01", familyIds: ["family-old-event"], attendance: [{ memberId: "member-a", present: true }], expenses: [], updatedAt: "2026-08-01T00:00:00.000Z" }],
      sharedGroups: [{ groupId: "group-main", role: "owner" }],
      settings: { language: "he", currency: "ILS", childAgeThreshold: 12, childWeight: 0.5, weightMode: "automatic", roundingMode: "nearest-0.5", reportFooter: "" },
    }));

    const migrated = localAppStorage.load();

    expect(migrated.billingUnits).toEqual([{ id: "family-a", groupId: "group-main", name: "משפחה א", order: 0 }]);
    expect(migrated.gatheringDrafts[0].familyIds).toEqual(["family-a"]);
    expect(migrated.gatheringDrafts[0].attendance).toEqual([{ memberId: "member-a", present: true }]);
  });
});

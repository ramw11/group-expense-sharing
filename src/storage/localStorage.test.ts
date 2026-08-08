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
      billingUnits: [{ id: "nitzan", groupId: "family-1", name: "ורהפטיג ניצן", order: 0 }],
      members: [{ id: "moti", billingUnitId: "nitzan", name: "מוטי", active: true, order: 0 }],
      gatheringDrafts: [{ groupId: "family-1", name: "נופש בעין יעקב", date: "2026-08-01", attendance: [{ memberId: "moti", present: true }], expenses: [], updatedAt: "2026-08-01T00:00:00.000Z" }],
      sharedGroups: [{ groupId: "family-1", role: "editor" }],
      settings: { language: "he", currency: "ILS", childAgeThreshold: 12, childWeight: 0.5, weightMode: "automatic", roundingMode: "nearest-0.5", reportFooter: "" },
    }));

    const migrated = localAppStorage.load();

    expect(migrated.version).toBe(4);
    expect(migrated.groups[0].name).toBe("משפחה");
    expect(migrated.gatheringDrafts[0]).toMatchObject({ id: "event-family-1-0", groupId: "family-1", name: "נופש בעין יעקב" });
    expect(migrated.gatheringDrafts[0].familyIds).toEqual(["nitzan"]);
    expect(migrated.sharedGroups[0].role).toBe("participant");
  });
});

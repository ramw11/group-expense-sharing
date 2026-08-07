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
      billingUnits: [],
      members: [],
      gatheringDrafts: [{ groupId: "family-1", name: "נופש בעין יעקב", date: "2026-08-01", attendance: [], expenses: [], updatedAt: "2026-08-01T00:00:00.000Z" }],
      sharedGroups: [],
      settings: { language: "he", currency: "ILS", childAgeThreshold: 12, childWeight: 0.5, weightMode: "automatic", roundingMode: "nearest-0.5", reportFooter: "" },
    }));

    const migrated = localAppStorage.load();

    expect(migrated.version).toBe(2);
    expect(migrated.groups[0].name).toBe("משפחה");
    expect(migrated.gatheringDrafts[0]).toMatchObject({ id: "event-family-1-0", groupId: "family-1", name: "נופש בעין יעקב" });
  });
});

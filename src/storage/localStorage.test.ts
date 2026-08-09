import { beforeEach, describe, expect, it, vi } from "vitest";
import { discardLegacyBusinessData, loadDevicePreferences, loadLegacyBusinessData, saveDevicePreferences } from "./localStorage";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

describe("device preferences", () => {
  it("stores only harmless device-local preferences", () => {
    saveDevicePreferences({ version: 1, language: "en", activeGroupId: "group-1", participantEventId: "event-1" });
    expect(loadDevicePreferences()).toEqual({ version: 1, language: "en", activeGroupId: "group-1", participantEventId: "event-1" });
    expect(values.get("group-expense-sharing:preferences")).not.toContain("expenses");
  });
});

describe("one-time legacy import", () => {
  it("converts legacy drafts to events with calculation snapshots", () => {
    values.set("group-expense-sharing:v1", JSON.stringify({
      version: 5,
      groups: [{ id: "group-1", name: "קבוצה" }],
      billingUnits: [{ id: "family-1", groupId: "group-1", name: "משפחה", order: 0 }],
      members: [{ id: "member-1", billingUnitId: "family-1", name: "חבר", active: true, order: 0 }],
      gatheringDrafts: [{ id: "event-1", groupId: "group-1", name: "אירוע", date: "2026-08-01", familyIds: ["family-1"], attendance: [{ memberId: "member-1", present: true }], expenses: [], updatedAt: "2026-08-01T00:00:00Z" }],
      sharedGroups: [{ groupId: "group-1", role: "owner" }],
      settings: { language: "he", currency: "ILS", childAgeThreshold: 12, childWeight: 0.5, weightMode: "automatic", roundingMode: "nearest-0.5", reportFooter: "" },
    }));

    const migrated = loadLegacyBusinessData();
    expect(migrated?.version).toBe(6);
    expect(migrated?.events[0]).toMatchObject({ id: "event-1", calculationSettings: { childAgeThreshold: 12, childWeight: 0.5, weightMode: "automatic", roundingMode: "nearest-0.5" } });
    discardLegacyBusinessData();
    expect(values.has("group-expense-sharing:v1")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ageOnDate, calculateEvent, createSettlements, memberWeight, roundAmount } from "./calculations";
import { calculationSettingsFrom, defaultSettings } from "../domain/defaults";
import type { BillingUnit, Event, Member } from "../domain/models";

const units: BillingUnit[] = [
  { id: "a", groupId: "g", name: "A", order: 0 },
  { id: "b", groupId: "g", name: "B", order: 1 },
];
const members: Member[] = [
  { id: "adult", billingUnitId: "a", name: "Adult", birthDate: "1990-01-01", active: true, order: 0 },
  { id: "child", billingUnitId: "b", name: "Child", birthDate: "2020-09-01", active: true, order: 0 },
];

describe("expense calculations", () => {
  it("calculates age on the gathering date", () => {
    expect(ageOnDate("2014-08-08", "2026-08-07")).toBe(11);
    expect(ageOnDate("2014-08-07", "2026-08-07")).toBe(12);
  });

  it("prioritizes manual weight, then birth date, then the default weight", () => {
    expect(memberWeight(members[1], "2026-08-07", defaultSettings)).toBe(0.5);
    expect(memberWeight({ ...members[1], manualWeight: 0.75 }, "2026-08-07", defaultSettings)).toBe(0.75);
    expect(memberWeight({ ...members[1], manualWeight: 0 }, "2026-08-07", defaultSettings)).toBe(0);
    expect(memberWeight({ ...members[1], birthDate: undefined }, "2026-08-07", defaultSettings)).toBe(1);
    expect(memberWeight(members[1], "2026-08-07", { ...defaultSettings, weightMode: "manual" })).toBe(0.5);
  });

  it("splits expenses by attendee weight and billing unit", () => {
    const result = calculateEvent({ date: "2026-08-07", units, members, attendance: members.map((member) => ({ memberId: member.id, present: true })), expenses: [{ id: "e", billingUnitId: "a", amount: 150 }], settings: { ...defaultSettings, roundingMode: "none" } });
    expect(result.totalWeight).toBe(1.5);
    expect(result.costPerWeight).toBe(100);
    expect(result.unitSummaries).toEqual([
      { billingUnitId: "a", weight: 1, paid: 150, share: 100, balance: 50 },
      { billingUnitId: "b", weight: 0.5, paid: 0, share: 50, balance: -50 },
    ]);
  });

  it("supports configured monetary rounding", () => {
    expect(roundAmount(10.26, "nearest-0.5")).toBe(10.5);
    expect(roundAmount(10.49, "nearest-1")).toBe(10);
    expect(roundAmount(10.126, "none")).toBe(10.13);
  });

  it("creates a minimal greedy settlement", () => {
    expect(createSettlements([
      { billingUnitId: "a", weight: 1, paid: 100, share: 40, balance: 60 },
      { billingUnitId: "b", weight: 1, paid: 0, share: 25, balance: -25 },
      { billingUnitId: "c", weight: 1, paid: 0, share: 35, balance: -35 },
    ])).toEqual([
      { fromBillingUnitId: "b", toBillingUnitId: "a", amount: 25 },
      { fromBillingUnitId: "c", toBillingUnitId: "a", amount: 35 },
    ]);
  });

  it("aggregates different reporters under the family that paid", () => {
    const reporters: Member[] = [
      { id: "reporter-a", billingUnitId: "a", name: "Reporter A", active: true, order: 0 },
      { id: "reporter-b", billingUnitId: "a", name: "Reporter B", active: true, order: 1 },
      members[1],
    ];
    const result = calculateEvent({
      date: "2026-08-07",
      units,
      members: reporters,
      attendance: reporters.map((member) => ({ memberId: member.id, present: true })),
      expenses: [
        { id: "e1", billingUnitId: "a", reportedByMemberId: "reporter-a", amount: 40 },
        { id: "e2", billingUnitId: "a", reportedByMemberId: "reporter-b", amount: 60 },
      ],
      settings: calculationSettingsFrom(defaultSettings),
    });
    expect(result.unitSummaries.find((summary) => summary.billingUnitId === "a")?.paid).toBe(100);
  });

  it("reconciles allocation, balances and settlements to the cent", () => {
    const result = calculateEvent({
      date: "2026-08-07",
      units,
      members,
      attendance: members.map((member) => ({ memberId: member.id, present: true })),
      expenses: [{ id: "e", billingUnitId: "a", amount: 169.3 }],
      settings: { ...calculationSettingsFrom(defaultSettings), roundingMode: "nearest-0.5" },
    });
    const allocated = result.unitSummaries.reduce((sum, summary) => sum + summary.share, 0);
    const balance = result.unitSummaries.reduce((sum, summary) => sum + summary.balance, 0);
    const settled = createSettlements(result.unitSummaries).reduce((sum, settlement) => sum + settlement.amount, 0);
    const debt = result.unitSummaries.filter((summary) => summary.balance < 0).reduce((sum, summary) => sum - summary.balance, 0);
    expect(allocated).toBeCloseTo(result.totalPaid, 2);
    expect(balance).toBeCloseTo(0, 2);
    expect(settled).toBeCloseTo(debt, 2);
  });

  it("uses the event snapshot after global defaults change", () => {
    const event: Event = {
      id: "historical",
      groupId: "g",
      name: "Historical",
      date: "2026-08-07",
      familyIds: units.map((unit) => unit.id),
      attendance: members.map((member) => ({ memberId: member.id, present: true })),
      expenses: [{ id: "e", billingUnitId: "a", amount: 150 }],
      calculationSettings: calculationSettingsFrom(defaultSettings),
      updatedAt: "2026-08-07T12:00:00Z",
    };
    const before = calculateEvent({ ...event, units, members, settings: event.calculationSettings });
    const changedDefaults = { ...defaultSettings, childWeight: 1, childAgeThreshold: 5, roundingMode: "nearest-1" as const };
    const after = calculateEvent({ ...event, units, members, settings: event.calculationSettings });
    expect(calculationSettingsFrom(changedDefaults)).not.toEqual(event.calculationSettings);
    expect(after).toEqual(before);
  });
});

import { describe, expect, it } from "vitest";
import { ageOnDate, calculateGathering, createSettlements, memberWeight, roundAmount } from "./calculations";
import { defaultSettings } from "../domain/defaults";
import type { BillingUnit, Member } from "../domain/models";

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

  it("uses birth date in automatic mode and manual weight in manual mode", () => {
    expect(memberWeight(members[1], "2026-08-07", defaultSettings)).toBe(0.5);
    expect(memberWeight({ ...members[1], manualWeight: 0.75 }, "2026-08-07", { ...defaultSettings, weightMode: "manual" })).toBe(0.75);
  });

  it("splits expenses by attendee weight and billing unit", () => {
    const result = calculateGathering({ date: "2026-08-07", units, members, attendance: members.map((member) => ({ memberId: member.id, present: true })), expenses: [{ id: "e", billingUnitId: "a", amount: 150 }], settings: { ...defaultSettings, roundingMode: "none" } });
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
});

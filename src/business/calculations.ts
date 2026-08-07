import type { Attendance, BillingUnit, Expense, Member, RoundingMode, Settings } from "../domain/models";

export interface MemberShare {
  memberId: string;
  billingUnitId: string;
  weight: number;
  share: number;
}

export interface BillingUnitSummary {
  billingUnitId: string;
  weight: number;
  paid: number;
  share: number;
  balance: number;
}

export interface GatheringCalculation {
  totalPaid: number;
  totalWeight: number;
  costPerWeight: number;
  memberShares: MemberShare[];
  unitSummaries: BillingUnitSummary[];
}

export interface Settlement {
  fromBillingUnitId: string;
  toBillingUnitId: string;
  amount: number;
}

export const ageOnDate = (birthDate: string, onDate: string): number => {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = onDate.split("-").map(Number);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age;
};

export const memberWeight = (member: Member, gatheringDate: string, settings: Settings): number => {
  if (settings.weightMode === "manual") return member.manualWeight ?? 1;
  if (!member.birthDate) return 1;
  return ageOnDate(member.birthDate, gatheringDate) < settings.childAgeThreshold ? settings.childWeight : 1;
};

export const roundAmount = (amount: number, mode: RoundingMode): number => {
  const increment = mode === "nearest-1" ? 1 : mode === "nearest-0.5" ? 0.5 : 0.01;
  return Math.round((amount + Number.EPSILON) / increment) * increment;
};

interface CalculateInput {
  date: string;
  units: BillingUnit[];
  members: Member[];
  attendance: Attendance[];
  expenses: Expense[];
  settings: Settings;
}

export const calculateGathering = ({ date, units, members, attendance, expenses, settings }: CalculateInput): GatheringCalculation => {
  const presentIds = new Set(attendance.filter((item) => item.present).map((item) => item.memberId));
  const attendees = members.filter((member) => member.active && presentIds.has(member.id));
  const totalPaid = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const weightedMembers = attendees.map((member) => ({ member, weight: memberWeight(member, date, settings) }));
  const totalWeight = weightedMembers.reduce((sum, item) => sum + item.weight, 0);
  const costPerWeight = totalWeight > 0 ? totalPaid / totalWeight : 0;
  const memberShares = weightedMembers.map(({ member, weight }) => ({ memberId: member.id, billingUnitId: member.billingUnitId, weight, share: weight * costPerWeight }));
  const rawSummaries = units.map((unit) => {
    const paid = expenses.filter((expense) => expense.billingUnitId === unit.id).reduce((sum, expense) => sum + expense.amount, 0);
    const unitShares = memberShares.filter((share) => share.billingUnitId === unit.id);
    const share = unitShares.reduce((sum, item) => sum + item.share, 0);
    return { billingUnitId: unit.id, weight: unitShares.reduce((sum, item) => sum + item.weight, 0), paid, share };
  });
  let lastWeightedIndex = -1;
  for (let index = rawSummaries.length - 1; index >= 0; index -= 1) {
    if (rawSummaries[index].weight > 0) { lastWeightedIndex = index; break; }
  }
  let allocated = 0;
  const unitSummaries = rawSummaries.map((summary, index) => {
    const share = index === lastWeightedIndex ? totalPaid - allocated : roundAmount(summary.share, settings.roundingMode);
    allocated += share;
    return { ...summary, share, balance: roundAmount(summary.paid - share, "none") };
  });
  return { totalPaid, totalWeight, costPerWeight, memberShares, unitSummaries };
};

export const createSettlements = (summaries: BillingUnitSummary[]): Settlement[] => {
  const debtors = summaries.filter((item) => item.balance < -0.004).map((item) => ({ id: item.billingUnitId, amount: -item.balance }));
  const creditors = summaries.filter((item) => item.balance > 0.004).map((item) => ({ id: item.billingUnitId, amount: item.balance }));
  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundAmount(Math.min(debtor.amount, creditor.amount), "none");
    if (amount > 0) settlements.push({ fromBillingUnitId: debtor.id, toBillingUnitId: creditor.id, amount });
    debtor.amount = roundAmount(debtor.amount - amount, "none");
    creditor.amount = roundAmount(creditor.amount - amount, "none");
    if (debtor.amount <= 0.004) debtorIndex += 1;
    if (creditor.amount <= 0.004) creditorIndex += 1;
  }
  return settlements;
};

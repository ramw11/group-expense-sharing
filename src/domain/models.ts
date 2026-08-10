export type Id = string;

export interface Group {
  id: Id;
  name: string;
}

export interface BillingUnit {
  id: Id;
  groupId: Id;
  name: string;
  order: number;
}

export interface Member {
  id: Id;
  billingUnitId: Id;
  name: string;
  birthDate?: string;
  manualWeight?: number;
  active: boolean;
  notes?: string;
  order: number;
}

export interface Expense {
  id: Id;
  billingUnitId: Id;
  reportedByMemberId?: Id;
  description?: string;
  notes?: string;
  amount: number;
  receiptUrl?: string;
  receiptPath?: string;
}

export interface Attendance {
  memberId: Id;
  present: boolean;
}

export type WeightMode = "automatic" | "manual";
export type RoundingMode = "none" | "nearest-0.5" | "nearest-1";
export type Language = "he" | "en";

export interface Settings {
  language: Language;
  currency: string;
  childAgeThreshold: number;
  childWeight: number;
  weightMode: WeightMode;
  roundingMode: RoundingMode;
  reportFooter: string;
}

export type CalculationSettings = Pick<Settings, "childAgeThreshold" | "childWeight" | "weightMode" | "roundingMode">;

export interface PersistentData {
  version: 6;
  groups: Group[];
  billingUnits: BillingUnit[];
  members: Member[];
  events: Event[];
  settings: Settings;
}

export interface CloudConnection {
  groupId: Id;
  role: "owner" | "participant";
  eventId?: Id;
}

export interface Event {
  id: Id;
  groupId: Id;
  name: string;
  date: string;
  familyIds: Id[];
  attendance: Attendance[];
  expenses: Expense[];
  calculationSettings: CalculationSettings;
  updatedAt: string;
}

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
  description?: string;
  amount: number;
  receiptUrl?: string;
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

export interface PersistentData {
  version: 3;
  groups: Group[];
  billingUnits: BillingUnit[];
  members: Member[];
  gatheringDrafts: GatheringDraft[];
  sharedGroups: SharedGroupConnection[];
  settings: Settings;
}

export interface SharedGroupConnection {
  groupId: Id;
  inviteToken?: string;
  role: "owner" | "editor";
}

export interface GatheringDraft {
  id: Id;
  groupId: Id;
  name: string;
  date: string;
  familyIds: Id[];
  attendance: Attendance[];
  expenses: Expense[];
  updatedAt: string;
}

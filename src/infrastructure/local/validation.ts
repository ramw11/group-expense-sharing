import type { PersistentData } from "../../domain/models";

export const validatePersistentData = (value: unknown): PersistentData => {
  if (!value || typeof value !== "object") throw new Error("קובץ הנתונים אינו תקין");
  const data = value as Partial<PersistentData>;
  if (data.version !== 6) throw new Error("גרסת הנתונים אינה נתמכת");
  if (!Array.isArray(data.groups) || !Array.isArray(data.billingUnits) || !Array.isArray(data.members) || !Array.isArray(data.events) || !data.settings) {
    throw new Error("מבנה הנתונים חסר או פגום");
  }
  const familyIds = new Set(data.billingUnits.map((item) => item.id));
  if (data.members.some((member) => !familyIds.has(member.billingUnitId))) throw new Error("נמצא חבר ללא משפחה תקינה");
  if (data.events.some((event) => event.expenses.some((expense) => !familyIds.has(expense.billingUnitId)))) throw new Error("נמצאה הוצאה ללא משפחה תקינה");
  return structuredClone(data as PersistentData);
};

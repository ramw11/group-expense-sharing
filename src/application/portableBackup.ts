import type { Expense, PersistentData } from "../domain/models";
import { validatePersistentData } from "../infrastructure/local/validation";

export const BACKUP_FORMAT = "group-expense-sharing-backup";
export const BACKUP_VERSION = 1;

export interface PortableBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: PersistentData;
  receipts: Record<string, string>;
  checksum: string;
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const digest = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
const checksumPayload = (backup: Omit<PortableBackup, "checksum">) => JSON.stringify(backup);

export const createPortableBackup = async (data: PersistentData, readReceipt: (expense: Expense) => Promise<string | undefined>): Promise<PortableBackup> => {
  const safeData = validatePersistentData(data);
  const receipts: Record<string, string> = {};
  for (const event of safeData.events) {
    for (const expense of event.expenses) {
      const content = await readReceipt(expense).catch(() => undefined);
      if (content) receipts[expense.id] = content;
      delete expense.receiptUrl;
    }
  }
  const payload = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), data: safeData, receipts } as const;
  return { ...payload, checksum: await digest(checksumPayload(payload)) };
};

export const parsePortableBackup = async (raw: string): Promise<PortableBackup> => {
  const value = JSON.parse(raw) as Partial<PortableBackup>;
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION || !value.data || !value.receipts || !value.createdAt || !value.checksum) throw new Error("קובץ הגיבוי אינו נתמך או חסר");
  const payload = { format: value.format, version: value.version, createdAt: value.createdAt, data: validatePersistentData(value.data), receipts: value.receipts };
  if (await digest(checksumPayload(payload)) !== value.checksum) throw new Error("בדיקת התקינות של הגיבוי נכשלה");
  return { ...payload, checksum: value.checksum };
};

export const dataWithEmbeddedReceipts = (backup: PortableBackup): PersistentData => ({
  ...backup.data,
  events: backup.data.events.map((event) => ({
    ...event,
    expenses: event.expenses.map((expense) => ({ ...expense, receiptUrl: backup.receipts[expense.id] })),
  })),
});

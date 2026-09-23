import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { DataRepository, ReceiptFileStore } from "../../application/ports";
import { emptyPersistentData } from "../../domain/defaults";
import type { PersistentData } from "../../domain/models";
import { validatePersistentData } from "./validation";

const DATABASE = "group-expense-sharing-local";
const SCHEMA_VERSION = 1;

const withoutRuntimeReceiptUrls = (data: PersistentData): PersistentData => ({
  ...data,
  events: data.events.map((event) => ({
    ...event,
    expenses: event.expenses.map((expense) => {
      const stored = { ...expense };
      delete stored.receiptUrl;
      return stored;
    }),
  })),
});

export class AndroidDataRepository implements DataRepository {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private connection?: SQLiteDBConnection;
  private writeQueue: Promise<PersistentData> = Promise.resolve(emptyPersistentData());

  constructor(private readonly receipts: ReceiptFileStore) {}

  async initialize() {
    if (this.connection) return;
    const existing = await this.sqlite.isConnection(DATABASE, false);
    this.connection = existing.result
      ? await this.sqlite.retrieveConnection(DATABASE, false)
      : await this.sqlite.createConnection(DATABASE, false, "no-encryption", SCHEMA_VERSION, false);
    await this.connection.open();
    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
    `);
  }

  private async hydrate(data: PersistentData) {
    const events = await Promise.all(data.events.map(async (event) => ({
      ...event,
      expenses: await Promise.all(event.expenses.map(async (expense) => ({
        ...expense,
        receiptUrl: expense.receiptPath ? await this.receipts.publicUrl(expense.receiptPath).catch(() => undefined) : undefined,
      }))),
    })));
    return { ...data, events };
  }

  async load() {
    await this.initialize();
    const result = await this.connection!.query("SELECT payload FROM app_state WHERE id = 1;");
    const payload = result.values?.[0]?.payload;
    if (typeof payload !== "string") return emptyPersistentData();
    return this.hydrate(validatePersistentData(JSON.parse(payload)));
  }

  private async normalizeReceipts(data: PersistentData) {
    const events = await Promise.all(data.events.map(async (event) => ({
      ...event,
      expenses: await Promise.all(event.expenses.map(async (expense) => {
        if (!expense.receiptUrl?.startsWith("data:")) return expense;
        const receiptPath = await this.receipts.persist(expense.receiptUrl, expense.id);
        return { ...expense, receiptPath, receiptUrl: await this.receipts.publicUrl(receiptPath) };
      })),
    })));
    return { ...data, events };
  }

  async save(data: PersistentData) {
    this.writeQueue = this.writeQueue.catch(() => emptyPersistentData()).then(async () => {
      await this.initialize();
      const normalized = await this.normalizeReceipts(validatePersistentData(data));
      const payload = JSON.stringify(withoutRuntimeReceiptUrls(normalized));
      await this.connection!.run(
        "INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at;",
        [payload, new Date().toISOString()],
        true,
      );
      return normalized;
    });
    return this.writeQueue;
  }

  async replace(data: PersistentData) { return this.save(data); }

  async close() {
    if (!this.connection) return;
    await this.connection.close();
    await this.sqlite.closeConnection(DATABASE, false).catch(() => undefined);
    this.connection = undefined;
  }
}

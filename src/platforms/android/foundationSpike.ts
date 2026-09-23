import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const databaseName = "solo-admin-foundation-spike";

export type DatabaseSpikeResult = {
  id: number;
  value: string;
};

export type ReceiptSpikeResult = {
  path: string;
  bytes: number;
};

export const runDatabaseSpike = async (): Promise<DatabaseSpikeResult> => {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const connection = await sqlite.createConnection(databaseName, false, "no-encryption", 1, false);

  try {
    await connection.open();
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS foundation_spike (
        id INTEGER PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const value = `android-${new Date().toISOString()}`;
    const insert = await connection.run(
      "INSERT INTO foundation_spike (value, created_at) VALUES (?, ?);",
      [value, new Date().toISOString()],
    );
    const id = Number(insert.changes?.lastId ?? 0);
    const query = await connection.query(
      "SELECT id, value FROM foundation_spike WHERE id = ?;",
      [id],
    );
    const row = query.values?.[0] as { id?: number; value?: string } | undefined;

    if (!row || row.value !== value) throw new Error("SQLite read-after-write verification failed");
    return { id: Number(row.id), value: row.value };
  } finally {
    await connection.close().catch(() => undefined);
    await sqlite.closeConnection(databaseName, false).catch(() => undefined);
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error("Could not read selected image"));
  reader.onload = () => {
    const result = String(reader.result ?? "");
    const comma = result.indexOf(",");
    if (comma < 0) reject(new Error("Selected image did not produce a data URL"));
    else resolve(result.slice(comma + 1));
  };
  reader.readAsDataURL(blob);
});

export const runReceiptStorageSpike = async (): Promise<ReceiptSpikeResult> => {
  const photo = await Camera.getPhoto({
    source: CameraSource.Photos,
    resultType: CameraResultType.Uri,
    quality: 85,
    correctOrientation: true,
  });
  if (!photo.webPath) throw new Error("Android photo picker returned no readable URI");

  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error(`Could not read selected image (${response.status})`);
  const blob = await response.blob();
  const data = await blobToBase64(blob);
  const extension = photo.format === "png" ? "png" : "jpg";
  const path = `receipts/foundation-spike-${Date.now()}.${extension}`;

  await Filesystem.writeFile({ path, data, directory: Directory.Data, recursive: true });
  const stat = await Filesystem.stat({ path, directory: Directory.Data });
  if (stat.size <= 0) throw new Error("Private receipt copy is empty");
  return { path, bytes: stat.size };
};

import type { PersistentData } from "../domain/models";

export interface DataRepository {
  initialize(): Promise<void>;
  load(): Promise<PersistentData>;
  save(data: PersistentData): Promise<PersistentData>;
  replace(data: PersistentData): Promise<PersistentData>;
  close(): Promise<void>;
}

export interface PortableFile {
  name: string;
  mimeType: string;
  data: string;
}

export interface FileExporter {
  export(file: PortableFile): Promise<void>;
}

export interface ReceiptFileStore {
  persist(dataUrl: string, expenseId: string): Promise<string>;
  publicUrl(path: string): Promise<string>;
  read(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

import type { PersistentData } from "../domain/models";

export interface AppStorage {
  load(): PersistentData;
  save(data: PersistentData): void;
}

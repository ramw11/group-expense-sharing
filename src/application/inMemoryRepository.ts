import { emptyPersistentData } from "../domain/defaults";
import type { PersistentData } from "../domain/models";
import type { DataRepository } from "./ports";

const copy = (data: PersistentData): PersistentData => structuredClone(data);

export class InMemoryDataRepository implements DataRepository {
  private data: PersistentData;

  constructor(seed: PersistentData = emptyPersistentData()) {
    this.data = copy(seed);
  }

  async initialize() {}

  async load() { return copy(this.data); }

  async save(data: PersistentData) {
    this.data = copy(data);
    return this.load();
  }

  async replace(data: PersistentData) { return this.save(data); }

  async close() {}
}

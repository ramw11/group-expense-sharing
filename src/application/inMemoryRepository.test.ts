import { describe, expect, it } from "vitest";
import { emptyPersistentData } from "../domain/defaults";
import { InMemoryDataRepository } from "./inMemoryRepository";

describe("InMemoryDataRepository", () => {
  it("isolates loaded state from persisted state", async () => {
    const source = emptyPersistentData();
    source.groups.push({ id: "g1", name: "טיול" });
    const repository = new InMemoryDataRepository(source);
    const loaded = await repository.load();
    loaded.groups[0].name = "changed";
    expect((await repository.load()).groups[0].name).toBe("טיול");
  });
});

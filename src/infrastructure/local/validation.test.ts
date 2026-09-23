import { describe, expect, it } from "vitest";
import { emptyPersistentData } from "../../domain/defaults";
import { validatePersistentData } from "./validation";

describe("validatePersistentData", () => {
  it("accepts current data", () => expect(validatePersistentData(emptyPersistentData()).version).toBe(6));
  it("rejects unknown versions", () => expect(() => validatePersistentData({ ...emptyPersistentData(), version: 99 })).toThrow());
  it("rejects orphan members", () => expect(() => validatePersistentData({ ...emptyPersistentData(), members: [{ id: "m", billingUnitId: "missing", name: "X", active: true, order: 0 }] })).toThrow());
});

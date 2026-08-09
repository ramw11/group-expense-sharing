import { describe, expect, it } from "vitest";
import { selectPrimaryOwnedGroup } from "./repository";

describe("owner repository recovery", () => {
  it("prefers the owned group that contains the real families and events", () => {
    expect(selectPrimaryOwnedGroup(
      ["empty-group", "main-group"],
      ["main-group", "main-group", "main-group"],
      ["empty-group", "main-group", "main-group"],
    )).toBe("main-group");
  });
});

import { describe, expect, it } from "vitest";
import { invitationUrl, parseInvitationUrl, selectPrimaryOwnedGroup } from "./repository";

describe("owner repository recovery", () => {
  it("prefers the owned group that contains the real families and events", () => {
    expect(selectPrimaryOwnedGroup(
      ["empty-group", "main-group"],
      ["main-group", "main-group", "main-group"],
      ["empty-group", "main-group", "main-group"],
    )).toBe("main-group");
  });
});

describe("reporting invitation links", () => {
  const token = "a".repeat(64);

  it("creates a share-safe query link", () => {
    expect(invitationUrl(token, "event 1", "https://example.test/app/")).toBe(`https://example.test/app/?join=${token}&event=event+1`);
  });

  it("reads current query links", () => {
    expect(parseInvitationUrl(`https://example.test/app/?join=${token}&event=event-1`)).toEqual({ token, eventId: "event-1" });
  });

  it("keeps old fragment links working", () => {
    expect(parseInvitationUrl(`https://example.test/app/#join=${token}&event=event-2`)).toEqual({ token, eventId: "event-2" });
  });
});

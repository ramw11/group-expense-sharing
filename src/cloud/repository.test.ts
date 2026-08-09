import { describe, expect, it } from "vitest";
import { invitationUrl, parseInvitationUrl, retainedReceiptPath, selectOwnedGroup } from "./repository";

describe("owner repository recovery", () => {
  it("uses the preferred group and otherwise chooses deterministically", () => {
    expect(selectOwnedGroup(["second", "first"], "second")).toBe("second");
    expect(selectOwnedGroup(["second", "first"])).toBe("first");
  });
});

describe("reporting invitation links", () => {
  const token = "a".repeat(64);

  it("creates a share-safe query link", () => {
    expect(invitationUrl(token, "event 1", "https://example.test/app/")).toBe(`https://example.test/app/?event=event+1&access=${token}`);
  });

  it("reads current query links", () => {
    expect(parseInvitationUrl(`https://example.test/app/?event=event-1&access=${token}`)).toEqual({ token, eventId: "event-1" });
  });

  it("keeps old fragment links working", () => {
    expect(parseInvitationUrl(`https://example.test/app/#join=${token}&event=event-2`)).toEqual({ legacyToken: token, eventId: "event-2" });
  });
});

describe("receipt persistence", () => {
  it("keeps the storage path when the loaded URL is only a signed preview", () => {
    expect(retainedReceiptPath({ receiptPath: "group/event/expense.jpg", receiptUrl: "https://storage.test/signed" }))
      .toBe("group/event/expense.jpg");
  });

  it("uploads a newly captured data URL instead of reusing an old path", () => {
    expect(retainedReceiptPath({ receiptPath: "old.jpg", receiptUrl: "data:image/jpeg;base64,abc" })).toBeUndefined();
  });
});

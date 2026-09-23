import { describe, expect, it } from "vitest";
import { emptyPersistentData } from "../domain/defaults";
import { createPortableBackup, dataWithEmbeddedReceipts, parsePortableBackup } from "./portableBackup";

describe("portable backup", () => {
  it("round trips validated data and receipts", async () => {
    const data = emptyPersistentData();
    data.groups.push({ id: "g", name: "קבוצה" });
    data.billingUnits.push({ id: "f", groupId: "g", name: "משפחה", order: 0 });
    data.events.push({ id: "e", groupId: "g", name: "אירוע", date: "2026-09-23", familyIds: ["f"], attendance: [], expenses: [{ id: "x", billingUnitId: "f", amount: 12, receiptPath: "receipts/x.jpg" }], calculationSettings: { childAgeThreshold: 12, childWeight: .5, weightMode: "automatic", roundingMode: "nearest-0.5" }, updatedAt: "2026-09-23T00:00:00Z" });
    const backup = await createPortableBackup(data, async () => "data:image/jpeg;base64,QQ==");
    const parsed = await parsePortableBackup(JSON.stringify(backup));
    expect(dataWithEmbeddedReceipts(parsed).events[0].expenses[0].receiptUrl).toBe("data:image/jpeg;base64,QQ==");
  });

  it("rejects tampering", async () => {
    const backup = await createPortableBackup(emptyPersistentData(), async () => undefined);
    backup.createdAt = "changed";
    await expect(parsePortableBackup(JSON.stringify(backup))).rejects.toThrow();
  });
});

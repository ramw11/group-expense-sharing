import { describe, expect, it } from "vitest";
import { findLikelyReceiptAmount } from "./receiptOcr";

describe("findLikelyReceiptAmount", () => {
  it("prefers a labeled total", () => expect(findLikelyReceiptAmount("Item 99.90\nTOTAL 123.40\nCard 123.40")).toBe(123.4));
  it("recognizes a Hebrew total label", () => expect(findLikelyReceiptAmount("מוצר 15.00\nסה״כ ₪ 48.50")).toBe(48.5));
  it("uses an amount on the line after לתשלום", () => expect(findLikelyReceiptAmount("סה״כ לתשלום\n₪ 127.40\nמספר עסקה 99999")).toBe(127.4));
  it("can require an explicit total label", () => expect(findLikelyReceiptAmount("פריט 12.00\nמחיר 80.00", true)).toBeUndefined());
  it("falls back to the largest detected amount", () => expect(findLikelyReceiptAmount("12.00\n87,30\n6.20")).toBe(87.3));
  it("prefers a repeated receipt total over reference numbers", () => expect(findLikelyReceiptAmount(".5300\n8324726 14\n4,00 12.00\n14.,00\n14")).toBe(14));
  it("does not guess from bare reference numbers", () => expect(findLikelyReceiptAmount("Receipt 8324726\nTerminal 5300")).toBeUndefined());
});

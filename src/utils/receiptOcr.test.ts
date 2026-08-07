import { describe, expect, it } from "vitest";
import { findLikelyReceiptAmount } from "./receiptOcr";

describe("findLikelyReceiptAmount", () => {
  it("prefers a labeled total", () => expect(findLikelyReceiptAmount("Item 99.90\nTOTAL 123.40\nCard 123.40")).toBe(123.4));
  it("recognizes a Hebrew total label", () => expect(findLikelyReceiptAmount("מוצר 15.00\nסה״כ ₪ 48.50")).toBe(48.5));
  it("falls back to the largest detected amount", () => expect(findLikelyReceiptAmount("12.00\n87,30\n6.20")).toBe(87.3));
});

import { describe, expect, it } from "vitest";
import { needsRestock, stockStatus, suggestedRestock } from "@/lib/domain/stock";

describe("stock thresholds", () => {
  it("reports out of stock regardless of rules", () => {
    expect(stockStatus(0, null)).toBe("out");
    expect(stockStatus(0, { minQuantity: 0 })).toBe("out");
  });

  it("is low only below the minimum", () => {
    expect(stockStatus(1, { minQuantity: 2 })).toBe("low");
    expect(stockStatus(2, { minQuantity: 2 })).toBe("ok");
    expect(stockStatus(5, null)).toBe("ok");
  });

  it("only flags restock when a rule exists", () => {
    expect(needsRestock(0, null)).toBe(false);
    expect(needsRestock(0, { minQuantity: 1 })).toBe(true);
    expect(needsRestock(1, { minQuantity: 1 })).toBe(false);
    expect(needsRestock(0, { minQuantity: 0 })).toBe(false);
  });
});

describe("restock suggestions", () => {
  it("fills up to the target when one is set", () => {
    expect(suggestedRestock(1, { minQuantity: 2, targetQuantity: 6 }, "pcs")).toBe(5);
  });

  it("uses min × multiplier otherwise", () => {
    expect(suggestedRestock(1, { minQuantity: 2 }, "pcs", 2)).toBe(3);
    expect(suggestedRestock(0.5, { minQuantity: 1 }, "kg", 3)).toBe(2.5);
  });

  it("rounds discrete units up and keeps continuous precision", () => {
    expect(suggestedRestock(0.5, { minQuantity: 2 }, "pcs", 1.5)).toBe(3);
    expect(suggestedRestock(0.1, { minQuantity: 0.3 }, "kg", 2)).toBe(0.5);
  });

  it("suggests nothing when stock is sufficient or no rule exists", () => {
    expect(suggestedRestock(5, { minQuantity: 2 }, "pcs")).toBe(0);
    expect(suggestedRestock(0, null, "pcs")).toBe(0);
  });

  it("falls back to a safe multiplier for invalid settings", () => {
    expect(suggestedRestock(0, { minQuantity: 1 }, "pcs", Number.NaN)).toBe(2);
    expect(suggestedRestock(0, { minQuantity: 1 }, "pcs", 0.5)).toBe(2);
  });
});

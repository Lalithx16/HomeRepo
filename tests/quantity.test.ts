import { describe, expect, it } from "vitest";
import { addQuantities, applyDelta, NegativeQuantityError, parseQuantityInput, projectQuantity, setQuantity } from "@/lib/domain/quantity";

describe("quantity arithmetic", () => {
  it("avoids floating point drift", () => {
    expect(addQuantities(0.1, 0.2)).toBe(0.3);
    expect(applyDelta(1.1, -0.3)).toBe(0.8);
    expect(addQuantities(0.001, 0.002, 0.003)).toBe(0.006);
  });

  it("applies positive and negative deltas", () => {
    expect(applyDelta(2, 1.5)).toBe(3.5);
    expect(applyDelta(2, -2)).toBe(0);
  });

  it("prevents accidental negative quantities", () => {
    expect(() => applyDelta(1, -1.001)).toThrow(NegativeQuantityError);
    try {
      applyDelta(1, -3);
    } catch (error) {
      expect(error).toBeInstanceOf(NegativeQuantityError);
      expect((error as NegativeQuantityError).available).toBe(1);
      expect((error as NegativeQuantityError).requested).toBe(3);
    }
  });

  it("allows explicit absolute corrections but not negatives", () => {
    expect(setQuantity(4.12345)).toBe(4.123);
    expect(() => setQuantity(-1)).toThrow(RangeError);
    expect(() => setQuantity(Number.NaN)).toThrow(RangeError);
  });

  it("parses friendly input", () => {
    expect(parseQuantityInput("1.5")).toBe(1.5);
    expect(parseQuantityInput("1,5")).toBe(1.5);
    expect(parseQuantityInput(" 2 ")).toBe(2);
    expect(parseQuantityInput("1/2")).toBe(0.5);
    expect(parseQuantityInput("1 1/2")).toBe(1.5);
    expect(parseQuantityInput(".25")).toBe(0.25);
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("abc")).toBeNull();
    expect(parseQuantityInput("-1")).toBeNull();
    expect(parseQuantityInput("1/0")).toBeNull();
  });

  it("projects pending offline deltas without going below zero", () => {
    expect(projectQuantity(5, [-1, -1, 0.5])).toBe(3.5);
    expect(projectQuantity(1, [-3])).toBe(0);
  });
});

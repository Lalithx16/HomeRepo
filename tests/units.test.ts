import { describe, expect, it } from "vitest";
import {
  areUnitsCompatible,
  convertQuantity,
  defaultStep,
  formatQuantity,
  humanizeQuantity,
  IncompatibleUnitsError,
  isDiscreteUnit,
  tryConvertQuantity,
} from "@/lib/domain/units";

describe("unit conversions", () => {
  it("converts within mass", () => {
    expect(convertQuantity(1.5, "kg", "g")).toBe(1500);
    expect(convertQuantity(250, "g", "kg")).toBe(0.25);
    expect(convertQuantity(1, "lb", "g")).toBe(453.592);
  });

  it("converts within volume", () => {
    expect(convertQuantity(2, "l", "ml")).toBe(2000);
    expect(convertQuantity(3, "tsp", "tbsp")).toBe(1);
    expect(convertQuantity(1, "cup", "ml")).toBe(240);
  });

  it("converts counts", () => {
    expect(convertQuantity(1, "dozen", "pcs")).toBe(12);
    expect(convertQuantity(6, "pcs", "dozen")).toBe(0.5);
  });

  it("never treats mass and volume as interchangeable", () => {
    expect(areUnitsCompatible("g", "ml")).toBe(false);
    expect(() => convertQuantity(100, "g", "ml")).toThrow(IncompatibleUnitsError);
    expect(tryConvertQuantity(1, "kg", "l")).toBeNull();
  });

  it("only converts package units to themselves", () => {
    expect(areUnitsCompatible("can", "can")).toBe(true);
    expect(areUnitsCompatible("can", "jar")).toBe(false);
    expect(areUnitsCompatible("pack", "pcs")).toBe(false);
  });

  it("rejects unknown units", () => {
    expect(areUnitsCompatible("bogus", "g")).toBe(false);
  });

  it("formats and humanizes", () => {
    expect(formatQuantity(1, "loaf")).toBe("1 loaf");
    expect(formatQuantity(2, "loaf")).toBe("2 loaves");
    expect(formatQuantity(0.333333, "kg")).toBe("0.333 kg");
    expect(humanizeQuantity(1500, "g")).toEqual({ quantity: 1.5, unit: "kg" });
    expect(humanizeQuantity(0.25, "l")).toEqual({ quantity: 250, unit: "ml" });
    expect(humanizeQuantity(3, "pcs")).toEqual({ quantity: 3, unit: "pcs" });
  });

  it("knows discrete units and steps", () => {
    expect(isDiscreteUnit("pcs")).toBe(true);
    expect(isDiscreteUnit("bottle")).toBe(true);
    expect(isDiscreteUnit("g")).toBe(false);
    expect(defaultStep("g")).toBe(50);
    expect(defaultStep("kg")).toBe(0.25);
    expect(defaultStep("pcs")).toBe(1);
  });
});

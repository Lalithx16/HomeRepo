/**
 * Unit definitions mirror the `public.units` table (see the core schema migration).
 * Base units: g (mass), ml (volume), pcs (count). Package units such as "pack"
 * or "can" only convert to themselves — we never guess how much is in a pack,
 * and mass and volume are never treated as interchangeable.
 */
export type UnitDimension = "mass" | "volume" | "count" | "package";

export interface UnitDefinition {
  code: string;
  label: string;
  pluralLabel: string;
  dimension: UnitDimension;
  toBase: number;
}

const DEFINITIONS: UnitDefinition[] = [
  { code: "pcs", label: "piece", pluralLabel: "pieces", dimension: "count", toBase: 1 },
  { code: "dozen", label: "dozen", pluralLabel: "dozen", dimension: "count", toBase: 12 },
  { code: "g", label: "g", pluralLabel: "g", dimension: "mass", toBase: 1 },
  { code: "kg", label: "kg", pluralLabel: "kg", dimension: "mass", toBase: 1000 },
  { code: "mg", label: "mg", pluralLabel: "mg", dimension: "mass", toBase: 0.001 },
  { code: "oz", label: "oz", pluralLabel: "oz", dimension: "mass", toBase: 28.349523125 },
  { code: "lb", label: "lb", pluralLabel: "lb", dimension: "mass", toBase: 453.59237 },
  { code: "ml", label: "ml", pluralLabel: "ml", dimension: "volume", toBase: 1 },
  { code: "l", label: "L", pluralLabel: "L", dimension: "volume", toBase: 1000 },
  { code: "tsp", label: "tsp", pluralLabel: "tsp", dimension: "volume", toBase: 4.92892 },
  { code: "tbsp", label: "tbsp", pluralLabel: "tbsp", dimension: "volume", toBase: 14.7868 },
  { code: "cup", label: "cup", pluralLabel: "cups", dimension: "volume", toBase: 240 },
  { code: "fl_oz", label: "fl oz", pluralLabel: "fl oz", dimension: "volume", toBase: 29.5735 },
  { code: "pack", label: "pack", pluralLabel: "packs", dimension: "package", toBase: 1 },
  { code: "can", label: "can", pluralLabel: "cans", dimension: "package", toBase: 1 },
  { code: "bottle", label: "bottle", pluralLabel: "bottles", dimension: "package", toBase: 1 },
  { code: "jar", label: "jar", pluralLabel: "jars", dimension: "package", toBase: 1 },
  { code: "box", label: "box", pluralLabel: "boxes", dimension: "package", toBase: 1 },
  { code: "bag", label: "bag", pluralLabel: "bags", dimension: "package", toBase: 1 },
  { code: "bunch", label: "bunch", pluralLabel: "bunches", dimension: "package", toBase: 1 },
  { code: "loaf", label: "loaf", pluralLabel: "loaves", dimension: "package", toBase: 1 },
];

export const UNITS: ReadonlyArray<UnitDefinition> = DEFINITIONS;
export const UNIT_CODES = DEFINITIONS.map((u) => u.code) as [string, ...string[]];

const BY_CODE = new Map(DEFINITIONS.map((u) => [u.code, u]));

export const UNIT_GROUPS: ReadonlyArray<{ label: string; dimension: UnitDimension }> = [
  { label: "Count", dimension: "count" },
  { label: "Weight", dimension: "mass" },
  { label: "Volume", dimension: "volume" },
  { label: "Packages", dimension: "package" },
];

export function isUnitCode(code: string): boolean {
  return BY_CODE.has(code);
}

export function getUnit(code: string): UnitDefinition {
  const unit = BY_CODE.get(code);
  if (!unit) throw new Error(`Unknown unit: ${code}`);
  return unit;
}

export function areUnitsCompatible(a: string, b: string): boolean {
  const ua = BY_CODE.get(a);
  const ub = BY_CODE.get(b);
  if (!ua || !ub) return false;
  if (ua.dimension !== ub.dimension) return false;
  return ua.dimension !== "package" || ua.code === ub.code;
}

/** Rounds to 3 decimal places — the precision stored by the database. */
export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export class IncompatibleUnitsError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot convert ${from} to ${to}`);
    this.name = "IncompatibleUnitsError";
  }
}

export function convertQuantity(quantity: number, from: string, to: string): number {
  if (from === to) return quantity;
  if (!areUnitsCompatible(from, to)) throw new IncompatibleUnitsError(from, to);
  return roundQuantity((quantity * getUnit(from).toBase) / getUnit(to).toBase);
}

/** Converts when possible, otherwise returns null. */
export function tryConvertQuantity(quantity: number, from: string, to: string): number | null {
  return areUnitsCompatible(from, to) ? convertQuantity(quantity, from, to) : null;
}

export function compatibleUnits(code: string): UnitDefinition[] {
  return DEFINITIONS.filter((u) => areUnitsCompatible(code, u.code));
}

/** Whole-number units where fractional quantities are unusual. */
export function isDiscreteUnit(code: string): boolean {
  const unit = BY_CODE.get(code);
  return !!unit && (unit.dimension === "count" || unit.dimension === "package");
}

/** A sensible +/- step for quick quantity steppers. */
export function defaultStep(code: string): number {
  switch (code) {
    case "g":
    case "ml":
      return 50;
    case "mg":
      return 100;
    case "kg":
    case "l":
    case "lb":
      return 0.25;
    default:
      return 1;
  }
}

export function formatNumber(value: number, maxFractionDigits = 3): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: maxFractionDigits }).format(roundQuantity(value));
}

export function unitLabel(code: string, quantity = 2): string {
  const unit = BY_CODE.get(code);
  if (!unit) return code;
  return Math.abs(quantity) === 1 ? unit.label : unit.pluralLabel;
}

export function formatQuantity(quantity: number, unit: string): string {
  return `${formatNumber(quantity)} ${unitLabel(unit, quantity)}`;
}

/**
 * Picks a friendlier unit for display (e.g. 1500 g -> 1.5 kg) without
 * changing the stored value.
 */
export function humanizeQuantity(quantity: number, unit: string): { quantity: number; unit: string } {
  if (unit === "g" && quantity >= 1000) return { quantity: roundQuantity(quantity / 1000), unit: "kg" };
  if (unit === "ml" && quantity >= 1000) return { quantity: roundQuantity(quantity / 1000), unit: "l" };
  if (unit === "kg" && quantity > 0 && quantity < 1) return { quantity: roundQuantity(quantity * 1000), unit: "g" };
  if (unit === "l" && quantity > 0 && quantity < 1) return { quantity: roundQuantity(quantity * 1000), unit: "ml" };
  return { quantity, unit };
}

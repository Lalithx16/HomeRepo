import { isDiscreteUnit, roundQuantity } from "./units";

export type StockStatus = "ok" | "low" | "out";

export interface StockRule {
  /** Minimum quantity to keep (same unit as total). */
  minQuantity: number;
  /** Optional level to restock up to. */
  targetQuantity?: number | null;
}

/** Status shown on items. "low" requires a rule; "out" means nothing left. */
export function stockStatus(total: number, rule: StockRule | null | undefined): StockStatus {
  if (total <= 0) return "out";
  if (rule && total < rule.minQuantity) return "low";
  return "ok";
}

/** Whether the product belongs on the low-stock page / shopping suggestions. */
export function needsRestock(total: number, rule: StockRule | null | undefined): boolean {
  return !!rule && total < rule.minQuantity;
}

/**
 * Suggested restock amount. Restock rule (configurable per household):
 *  - If the product has a target level, buy up to the target.
 *  - Otherwise buy up to `minQuantity × multiplier` (household setting, default 2).
 * Whole units are rounded up; continuous units are rounded to 3 decimals.
 * Returns 0 when nothing is needed.
 */
export function suggestedRestock(
  total: number,
  rule: StockRule | null | undefined,
  unit: string,
  multiplier = 2,
): number {
  if (!rule || !needsRestock(total, rule)) return 0;
  const safeMultiplier = Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 2;
  const goal = rule.targetQuantity != null && rule.targetQuantity > 0 ? rule.targetQuantity : rule.minQuantity * safeMultiplier;
  const missing = goal - Math.max(total, 0);
  if (missing <= 0) return 0;
  return isDiscreteUnit(unit) ? Math.ceil(roundQuantity(missing)) : roundQuantity(missing);
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

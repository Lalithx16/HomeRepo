import { roundQuantity } from "./units";

/** Quantities are stored with 3 decimals; do arithmetic in integer thousandths. */
const SCALE = 1000;

function toMilli(value: number): number {
  return Math.round(value * SCALE);
}

export function addQuantities(...values: number[]): number {
  return values.reduce((sum, v) => sum + toMilli(v), 0) / SCALE;
}

export class NegativeQuantityError extends Error {
  readonly available: number;
  readonly requested: number;

  constructor(available: number, requested: number) {
    super(`Only ${available} available`);
    this.name = "NegativeQuantityError";
    this.available = available;
    this.requested = requested;
  }
}

/**
 * Applies a delta to a quantity. Throws NegativeQuantityError rather than
 * silently producing a negative stock level; explicit corrections go through
 * `setQuantity` instead.
 */
export function applyDelta(current: number, delta: number): number {
  const next = (toMilli(current) + toMilli(delta)) / SCALE;
  if (next < 0) throw new NegativeQuantityError(current, -delta);
  return next;
}

export function setQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError("Quantity cannot be negative");
  return roundQuantity(value);
}

/** Parses user input such as "1.5", "1,5", " 2 ", or "1/2". Returns null when invalid. */
export function parseQuantityInput(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (fraction) {
    const den = Number(fraction[2]);
    if (den === 0) return null;
    return roundQuantity(Number(fraction[1]) / den);
  }
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return roundQuantity(Number(mixed[1]) + Number(mixed[2]) / den);
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? roundQuantity(value) : null;
}

/** Sums pending deltas (e.g. queued offline changes) onto a server quantity for display. */
export function projectQuantity(serverQuantity: number, pendingDeltas: number[]): number {
  const projected = addQuantities(serverQuantity, ...pendingDeltas);
  return projected < 0 ? 0 : projected;
}

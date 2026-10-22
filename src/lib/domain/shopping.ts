import { areUnitsCompatible, convertQuantity, roundQuantity } from "./units";

export interface ShoppingItemLike {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  productId: string | null;
  categoryName: string | null;
  storeSection: string | null;
  checkedAt: string | null;
}

export interface ShoppingGroup<T extends ShoppingItemLike> {
  key: string;
  label: string;
  items: T[];
}

/** Groups by store section (falling back to category), unchecked first within each group. */
export function groupShoppingItems<T extends ShoppingItemLike>(items: T[]): ShoppingGroup<T>[] {
  const groups = new Map<string, ShoppingGroup<T>>();
  for (const item of items) {
    const label = item.storeSection ?? item.categoryName ?? "Other";
    const key = label.toLowerCase();
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.key === "other") return 1;
    if (b.key === "other") return -1;
    return a.label.localeCompare(b.label);
  });
  for (const group of sorted) {
    group.items.sort(
      (a, b) => Number(Boolean(a.checkedAt)) - Number(Boolean(b.checkedAt)) || a.name.localeCompare(b.name),
    );
  }
  return sorted;
}

/**
 * Finds an open line that a new request should merge into: same product (or same
 * name when unlinked) and a compatible unit. Mirrors upsert_shopping_item() in SQL.
 */
export function findMergeTarget<T extends ShoppingItemLike>(
  items: T[],
  candidate: { name: string; productId: string | null; unit: string },
): T | undefined {
  return items.find(
    (item) =>
      !item.checkedAt &&
      (candidate.productId
        ? item.productId === candidate.productId
        : !item.productId && item.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()) &&
      areUnitsCompatible(item.unit, candidate.unit),
  );
}

export function mergedQuantity(existing: { quantity: number; unit: string }, add: { quantity: number; unit: string }): number {
  return roundQuantity(existing.quantity + convertQuantity(add.quantity, add.unit, existing.unit));
}

export function shoppingProgress(items: Array<{ checkedAt: string | null }>): { done: number; total: number } {
  return { done: items.filter((i) => i.checkedAt).length, total: items.length };
}

import { describe, expect, it } from "vitest";
import { findMergeTarget, groupShoppingItems, mergedQuantity, shoppingProgress, type ShoppingItemLike } from "@/lib/domain/shopping";

const item = (over: Partial<ShoppingItemLike>): ShoppingItemLike => ({
  id: Math.random().toString(36).slice(2),
  name: "Item",
  quantity: 1,
  unit: "pcs",
  productId: null,
  categoryName: null,
  storeSection: null,
  checkedAt: null,
  ...over,
});

describe("shopping list", () => {
  it("groups by store section, then category, with Other last", () => {
    const groups = groupShoppingItems([
      item({ name: "Milk", storeSection: "Dairy" }),
      item({ name: "Mystery" }),
      item({ name: "Apples", categoryName: "Produce" }),
      item({ name: "Butter", storeSection: "Dairy", checkedAt: "2026-10-21T10:00:00Z" }),
      item({ name: "Cheese", storeSection: "Dairy" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Dairy", "Produce", "Other"]);
    expect(groups[0]!.items.map((i) => i.name)).toEqual(["Cheese", "Milk", "Butter"]);
  });

  it("merges requests for the same product in compatible units", () => {
    const list = [item({ id: "rice", name: "Rice", productId: "p-rice", unit: "kg", quantity: 1 })];
    const target = findMergeTarget(list, { name: "Basmati", productId: "p-rice", unit: "g" });
    expect(target?.id).toBe("rice");
    expect(mergedQuantity(target!, { quantity: 500, unit: "g" })).toBe(1.5);
  });

  it("does not merge incompatible units or checked items", () => {
    const list = [
      item({ name: "Milk", unit: "l" }),
      item({ name: "Eggs", unit: "pcs", checkedAt: "2026-10-21T10:00:00Z" }),
    ];
    expect(findMergeTarget(list, { name: "milk", productId: null, unit: "g" })).toBeUndefined();
    expect(findMergeTarget(list, { name: "Eggs", productId: null, unit: "pcs" })).toBeUndefined();
    expect(findMergeTarget(list, { name: " MILK ", productId: null, unit: "ml" })?.name).toBe("Milk");
  });

  it("tracks progress", () => {
    expect(shoppingProgress([item({}), item({ checkedAt: "x" })])).toEqual({ done: 1, total: 2 });
  });
});

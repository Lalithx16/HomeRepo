import { describe, expect, it } from "vitest";
import {
  matchIngredient,
  matchRecipe,
  missingIngredientsForShopping,
  normalizeIngredientKey,
  productMatchesIngredient,
  rankRecipeMatches,
  type InventoryLotForMatching,
  type RecipeInput,
} from "@/lib/domain/recipes";

const lot = (over: Partial<InventoryLotForMatching>): InventoryLotForMatching => ({
  productId: "p1",
  productName: "Thing",
  ingredientKey: null,
  quantity: 1,
  unit: "pcs",
  expired: false,
  ...over,
});

const omelette: RecipeInput = {
  id: "omelette",
  ingredients: [
    { id: "i1", ingredientKey: "egg", displayName: "Eggs", quantity: 2, unit: "pcs", optional: false },
    { id: "i2", ingredientKey: "onion", displayName: "Onion", quantity: 50, unit: "g", optional: false },
    { id: "i3", ingredientKey: "salt", displayName: "Salt", quantity: null, unit: null, optional: false },
    { id: "i4", ingredientKey: "green chilli", displayName: "Chilli", quantity: 1, unit: "pcs", optional: true },
  ],
};

describe("ingredient key normalization", () => {
  it("singularizes and strips punctuation", () => {
    expect(normalizeIngredientKey("Tomatoes")).toBe("tomato");
    expect(normalizeIngredientKey("Eggs!")).toBe("egg");
    expect(normalizeIngredientKey("Green Chillies")).toBe("green chilli");
    expect(normalizeIngredientKey("Peas")).toBe("peas");
    expect(normalizeIngredientKey("Berries")).toBe("berry");
  });

  it("matches by explicit key first, then by words in the name", () => {
    expect(productMatchesIngredient({ productName: "India Gate Basmati Rice", ingredientKey: null }, "rice")).toBe(true);
    expect(productMatchesIngredient({ productName: "Rice Flour", ingredientKey: "rice flour" }, "rice")).toBe(false);
    expect(productMatchesIngredient({ productName: "Atta", ingredientKey: "wheat flour" }, "wheat flour")).toBe(true);
    expect(productMatchesIngredient({ productName: "Olive Oil", ingredientKey: null }, "olive")).toBe(true);
    expect(productMatchesIngredient({ productName: "Sunflower Oil", ingredientKey: null }, "olive oil")).toBe(false);
  });
});

describe("ingredient matching with quantities and units", () => {
  it("sums compatible units across lots", () => {
    const m = matchIngredient(omelette.ingredients[1]!, [
      lot({ productName: "Red Onions", quantity: 0.03, unit: "kg" }),
      lot({ productId: "p2", productName: "Onion", quantity: 25, unit: "g" }),
    ]);
    expect(m.status).toBe("available");
    expect(m.available).toBe(55);
    expect(m.productIds).toEqual(["p1", "p2"]);
  });

  it("reports insufficient quantities with the shortfall", () => {
    const m = matchIngredient(omelette.ingredients[0]!, [lot({ productName: "Eggs", quantity: 1 })]);
    expect(m.status).toBe("insufficient");
    expect(m.shortfall).toBe(1);
  });

  it("does not count expired or empty lots", () => {
    const m = matchIngredient(omelette.ingredients[0]!, [
      lot({ productName: "Eggs", quantity: 12, expired: true }),
      lot({ productName: "Eggs", quantity: 0 }),
    ]);
    expect(m.status).toBe("missing");
  });

  it("never claims availability when units are not comparable", () => {
    const m = matchIngredient(omelette.ingredients[0]!, [lot({ productName: "Eggs", quantity: 600, unit: "g" })]);
    expect(m.status).toBe("unverified");
    expect(m.available).toBeNull();
  });

  it("treats 'to taste' ingredients as staples that just need to exist", () => {
    expect(matchIngredient(omelette.ingredients[2]!, [lot({ productName: "Salt", quantity: 1, unit: "kg" })]).status).toBe(
      "staple",
    );
    expect(matchIngredient(omelette.ingredients[2]!, []).status).toBe("missing");
  });
});

describe("recipe availability", () => {
  const pantry = [
    lot({ productId: "e", productName: "Farm Eggs", quantity: 6 }),
    lot({ productId: "o", productName: "Onion", quantity: 1, unit: "kg" }),
    lot({ productId: "s", productName: "Sea Salt", quantity: 500, unit: "g" }),
  ];

  it("is ready when every required ingredient is covered (optional ones ignored)", () => {
    const match = matchRecipe(omelette, pantry);
    expect(match.availability).toBe("ready");
    expect(match.missingCount).toBe(0);
    expect(match.requiredCount).toBe(3);
  });

  it("is partial when at least half is on hand", () => {
    const match = matchRecipe(omelette, pantry.filter((l) => l.productId !== "e"));
    expect(match.availability).toBe("partial");
    expect(match.missingCount).toBe(1);
  });

  it("is unavailable with little on hand", () => {
    expect(matchRecipe(omelette, []).availability).toBe("unavailable");
  });

  it("produces shopping lines for shortfalls only", () => {
    const match = matchRecipe(omelette, [lot({ productName: "Eggs", quantity: 1 })]);
    const lines = missingIngredientsForShopping(match);
    expect(lines).toEqual([
      { ingredientKey: "egg", name: "Eggs", quantity: 1, unit: "pcs" },
      { ingredientKey: "onion", name: "Onion", quantity: 50, unit: "g" },
      { ingredientKey: "salt", name: "Salt", quantity: 1, unit: "pcs" },
    ]);
  });

  it("ranks ready recipes first, then fewest missing", () => {
    const ranked = rankRecipeMatches(
      [
        { name: "b", match: { ...matchRecipe(omelette, []), recipeId: "b" } },
        { name: "a", match: { ...matchRecipe(omelette, pantry), recipeId: "a" } },
      ],
      (x, y) => x.name.localeCompare(y.name),
    );
    expect(ranked.map((r) => r.name)).toEqual(["a", "b"]);
  });
});

import { addQuantities } from "./quantity";
import { areUnitsCompatible, convertQuantity, roundQuantity } from "./units";

/**
 * Deterministic recipe ↔ inventory matching (no AI).
 *
 * A product supplies an ingredient when:
 *  1. its explicit `ingredientKey` equals the ingredient key, or
 *  2. it has no explicit key and every word of the ingredient key appears in the
 *     product's normalized name (e.g. "rice" ⊂ "India Gate Basmati Rice").
 *
 * Quantities are summed across matching, non-expired lots in units compatible
 * with the recipe's unit. Lots in incompatible units (e.g. a recipe needs
 * "2 pcs" eggs but eggs are tracked in grams) are never counted as sufficient —
 * the ingredient is reported as `unverified` so we never over-promise.
 */

export interface InventoryLotForMatching {
  productId: string;
  productName: string;
  ingredientKey: string | null;
  quantity: number;
  unit: string;
  expired: boolean;
}

export interface RecipeIngredientInput {
  id: string;
  ingredientKey: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
}

export interface RecipeInput {
  id: string;
  ingredients: RecipeIngredientInput[];
}

export type IngredientStatus =
  | "available" // enough stock in compatible units
  | "staple" // no quantity needed ("to taste") and some stock exists
  | "insufficient" // some stock, but not enough
  | "unverified" // stock exists only in units we cannot compare
  | "missing"; // nothing in stock

export interface IngredientMatch {
  ingredient: RecipeIngredientInput;
  status: IngredientStatus;
  /** Available amount in the recipe unit (null when not comparable). */
  available: number | null;
  /** Shortfall in the recipe unit (0 when satisfied). */
  shortfall: number;
  productIds: string[];
  productNames: string[];
}

export type RecipeAvailability = "ready" | "partial" | "unavailable";

export interface RecipeMatch {
  recipeId: string;
  availability: RecipeAvailability;
  /** Required (non-optional) ingredients that are not fully covered. */
  missingCount: number;
  requiredCount: number;
  coveredCount: number;
  ingredients: IngredientMatch[];
}

const IRREGULAR: Record<string, string> = {
  tomatoes: "tomato",
  potatoes: "potato",
  leaves: "leaf",
  loaves: "loaf",
  chillies: "chilli",
  chilies: "chili",
  berries: "berry",
  cherries: "cherry",
  peas: "peas",
  oats: "oats",
  lentils: "lentil",
  noodles: "noodle",
  molasses: "molasses",
  hummus: "hummus",
  couscous: "couscous",
  asparagus: "asparagus",
};

function singularize(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word] as string;
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) return word.slice(0, -1);
  return word;
}

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
}

export function normalizeIngredientKey(text: string): string {
  return normalizeWords(text).join(" ").slice(0, 40);
}

export function productMatchesIngredient(
  product: { productName: string; ingredientKey: string | null },
  ingredientKey: string,
): boolean {
  const key = normalizeIngredientKey(ingredientKey);
  if (!key) return false;
  if (product.ingredientKey) return normalizeIngredientKey(product.ingredientKey) === key;
  const nameWords = new Set(normalizeWords(product.productName));
  return key.split(" ").every((w) => nameWords.has(w));
}

export function matchIngredient(ingredient: RecipeIngredientInput, lots: InventoryLotForMatching[]): IngredientMatch {
  const matching = lots.filter(
    (lot) => !lot.expired && lot.quantity > 0 && productMatchesIngredient(lot, ingredient.ingredientKey),
  );
  const productIds = [...new Set(matching.map((l) => l.productId))];
  const productNames = [...new Set(matching.map((l) => l.productName))];
  const base = { ingredient, productIds, productNames };

  if (ingredient.quantity === null || ingredient.unit === null) {
    // "To taste" ingredients only need to be present.
    return matching.length > 0
      ? { ...base, status: "staple", available: null, shortfall: 0 }
      : { ...base, status: "missing", available: 0, shortfall: 0 };
  }

  const recipeUnit = ingredient.unit;
  const comparable = matching.filter((l) => areUnitsCompatible(l.unit, recipeUnit));
  const available = roundQuantity(addQuantities(...comparable.map((l) => convertQuantity(l.quantity, l.unit, recipeUnit))));

  if (matching.length === 0) {
    return { ...base, status: "missing", available: 0, shortfall: ingredient.quantity };
  }
  if (available >= ingredient.quantity) {
    return { ...base, status: "available", available, shortfall: 0 };
  }
  if (comparable.length === 0) {
    return { ...base, status: "unverified", available: null, shortfall: ingredient.quantity };
  }
  return { ...base, status: "insufficient", available, shortfall: roundQuantity(ingredient.quantity - available) };
}

export function isCovered(match: IngredientMatch): boolean {
  return match.status === "available" || match.status === "staple";
}

export function matchRecipe(recipe: RecipeInput, lots: InventoryLotForMatching[]): RecipeMatch {
  const ingredients = recipe.ingredients.map((ing) => matchIngredient(ing, lots));
  const required = ingredients.filter((m) => !m.ingredient.optional);
  const covered = required.filter(isCovered);
  const missingCount = required.length - covered.length;
  // "partial" = at least half of the required ingredients are on hand.
  const availability: RecipeAvailability =
    missingCount === 0 ? "ready" : covered.length * 2 >= required.length ? "partial" : "unavailable";
  return {
    recipeId: recipe.id,
    availability,
    missingCount,
    requiredCount: required.length,
    coveredCount: covered.length,
    ingredients,
  };
}

/** Ready first, then fewest missing ingredients, then by the provided tiebreaker. */
export function rankRecipeMatches<T extends { match: RecipeMatch }>(items: T[], tiebreak?: (a: T, b: T) => number): T[] {
  const order: Record<RecipeAvailability, number> = { ready: 0, partial: 1, unavailable: 2 };
  return [...items].sort(
    (a, b) =>
      order[a.match.availability] - order[b.match.availability] ||
      a.match.missingCount - b.match.missingCount ||
      (tiebreak ? tiebreak(a, b) : 0),
  );
}

/** Shopping-list lines for every required ingredient that is not fully covered. */
export function missingIngredientsForShopping(
  match: RecipeMatch,
): Array<{ ingredientKey: string; name: string; quantity: number; unit: string }> {
  return match.ingredients
    .filter((m) => !m.ingredient.optional && !isCovered(m))
    .map((m) => ({
      ingredientKey: m.ingredient.ingredientKey,
      name: m.ingredient.displayName,
      quantity: m.ingredient.quantity === null ? 1 : m.shortfall > 0 ? m.shortfall : m.ingredient.quantity,
      unit: m.ingredient.unit ?? "pcs",
    }));
}

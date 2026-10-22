import {
  matchRecipe,
  rankRecipeMatches,
  type InventoryLotForMatching,
  type RecipeMatch,
} from "@/lib/domain/recipes";
import type { AppContext } from "./context";
import { num, numOrNull, type RecipeRow } from "@/lib/types";

const RECIPE_COLUMNS =
  "id, household_id, slug, name, description, image_url, icon, cuisine, prep_minutes, cook_minutes, servings, difficulty, diets, instructions, recipe_ingredients(id, position, ingredient_key, display_name, quantity, unit, optional, note)";

function normalizeRecipe(r: RecipeRow): RecipeRow {
  return {
    ...r,
    recipe_ingredients: [...(r.recipe_ingredients ?? [])]
      .map((i) => ({ ...i, quantity: numOrNull(i.quantity) }))
      .sort((a, b) => a.position - b.position),
  };
}

export async function listRecipes(ctx: AppContext): Promise<RecipeRow[]> {
  const { data } = await ctx.supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .or(`household_id.is.null,household_id.eq.${ctx.household.id}`)
    .order("name")
    .limit(500);
  return (data ?? []).map(normalizeRecipe);
}

export async function getRecipeBySlug(ctx: AppContext, slug: string): Promise<RecipeRow | null> {
  const { data } = await ctx.supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("slug", slug)
    .or(`household_id.is.null,household_id.eq.${ctx.household.id}`)
    .limit(1)
    .maybeSingle();
  return data ? normalizeRecipe(data as RecipeRow) : null;
}

/** Non-empty lots with product identity, for deterministic ingredient matching. */
export async function getInventoryForMatching(ctx: AppContext): Promise<InventoryLotForMatching[]> {
  const { data } = await ctx.supabase
    .from("inventory_lots")
    .select("product_id, quantity, unit, expiry_date, product:products(name, ingredient_key)")
    .eq("household_id", ctx.household.id)
    .gt("quantity", 0)
    .limit(5000);
  type Row = {
    product_id: string;
    quantity: number;
    unit: string;
    expiry_date: string | null;
    product: { name: string; ingredient_key: string | null } | null;
  };
  return ((data ?? []) as Row[])
    .filter((r) => r.product)
    .map((r) => ({
      productId: r.product_id,
      productName: r.product!.name,
      ingredientKey: r.product!.ingredient_key,
      quantity: num(r.quantity),
      unit: r.unit,
      expired: r.expiry_date !== null && r.expiry_date < ctx.today,
    }));
}

export function toRecipeInput(recipe: RecipeRow) {
  return {
    id: recipe.id,
    ingredients: recipe.recipe_ingredients.map((i) => ({
      id: i.id,
      ingredientKey: i.ingredient_key,
      displayName: i.display_name,
      quantity: i.quantity,
      unit: i.unit,
      optional: i.optional,
    })),
  };
}

export interface MatchedRecipe {
  recipe: RecipeRow;
  match: RecipeMatch;
}

export async function getMatchedRecipes(ctx: AppContext): Promise<MatchedRecipe[]> {
  const [recipes, lots] = await Promise.all([listRecipes(ctx), getInventoryForMatching(ctx)]);
  const matched = recipes.map((recipe) => ({ recipe, match: matchRecipe(toRecipeInput(recipe), lots) }));
  return rankRecipeMatches(
    matched,
    (a, b) =>
      a.recipe.prep_minutes + a.recipe.cook_minutes - (b.recipe.prep_minutes + b.recipe.cook_minutes) ||
      a.recipe.name.localeCompare(b.recipe.name),
  );
}

export async function listFavoriteRecipeIds(ctx: AppContext): Promise<Set<string>> {
  const { data } = await ctx.supabase
    .from("recipe_favorites")
    .select("recipe_id")
    .eq("household_id", ctx.household.id)
    .eq("user_id", ctx.user.id);
  return new Set((data ?? []).map((r: { recipe_id: string }) => r.recipe_id));
}

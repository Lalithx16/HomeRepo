"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { matchRecipe, missingIngredientsForShopping } from "@/lib/domain/recipes";
import { suggestedRestock } from "@/lib/domain/stock";
import { listRestockProducts } from "@/lib/data/inventory";
import { getInventoryForMatching, toRecipeInput } from "@/lib/data/recipes";
import { getDefaultList, productsOnList } from "@/lib/data/shopping";
import type { RecipeRow } from "@/lib/types";
import { completeShoppingSchema, shoppingItemSchema, updateShoppingItemSchema, uuid } from "@/lib/validation/schemas";
import { dbFail, editorContext, revalidateApp, validationFail } from "./helpers";

export async function addShoppingItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const list = await getDefaultList(ctx);
  if (!list) return fail("not_found", "No shopping list found.");
  const { data, error } = await ctx.supabase.rpc("upsert_shopping_item", {
    p_list_id: list.id,
    p_name: v.name,
    p_quantity: v.quantity,
    p_unit: v.unit,
    p_product_id: v.productId ?? null,
    p_category_id: v.categoryId ?? null,
    p_source: "manual",
    p_notes: v.notes ?? null,
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok({ id: data as string }, `${v.name} added`);
}

export async function updateShoppingItemAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = updateShoppingItemSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { error } = await guarded.ctx.supabase
    .from("shopping_list_items")
    .update({ name: v.name, quantity: v.quantity, unit: v.unit, category_id: v.categoryId ?? null, notes: v.notes ?? null })
    .eq("id", v.id)
    .eq("household_id", guarded.ctx.household.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Item updated");
}

async function setRemoved(ids: string[], removed: boolean): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  if (ids.length === 0 || ids.length > 500 || !ids.every((id) => uuid.safeParse(id).success)) {
    return fail("validation", "Invalid selection.");
  }
  const { error } = await guarded.ctx.supabase
    .from("shopping_list_items")
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .in("id", ids)
    .eq("household_id", guarded.ctx.household.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, removed ? (ids.length === 1 ? "Item removed" : `${ids.length} items removed`) : "Item restored");
}

export async function removeShoppingItemsAction(ids: string[]): Promise<ActionResult<null>> {
  return setRemoved(ids, true);
}

export async function restoreShoppingItemAction(id: string): Promise<ActionResult<null>> {
  return setRemoved([id], false);
}

export async function purgeRemovedShoppingItemsAction(): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { error } = await guarded.ctx.supabase
    .from("shopping_list_items")
    .delete()
    .eq("household_id", guarded.ctx.household.id)
    .not("removed_at", "is", null);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Removed items cleared");
}

/** Adds every product below its threshold that isn't already on the list. */
export async function addLowStockToListAction(): Promise<ActionResult<{ added: number }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  const [list, products, onList] = await Promise.all([getDefaultList(ctx), listRestockProducts(ctx), productsOnList(ctx)]);
  if (!list) return fail("not_found", "No shopping list found.");
  let added = 0;
  for (const p of products) {
    if (onList.has(p.id)) continue;
    const amount = suggestedRestock(
      p.total_quantity,
      p.min_quantity != null ? { minQuantity: p.min_quantity, targetQuantity: p.target_quantity } : null,
      p.default_unit,
      ctx.household.restock_multiplier,
    );
    if (amount <= 0) continue;
    const { error } = await ctx.supabase.rpc("upsert_shopping_item", {
      p_list_id: list.id,
      p_name: p.name,
      p_quantity: amount,
      p_unit: p.default_unit,
      p_product_id: p.id,
      p_category_id: p.category_id,
      p_source: "low_stock",
    });
    if (error) return dbFail(error);
    added += 1;
  }
  revalidateApp();
  return ok({ added }, added === 0 ? "Everything low is already on your list" : `Added ${added} ${added === 1 ? "item" : "items"}`);
}

/** Recomputes the recipe match server-side and adds the shortfall for each missing ingredient. */
export async function addRecipeMissingToListAction(recipeId: string): Promise<ActionResult<{ added: number }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(recipeId).success) return fail("validation", "Invalid recipe.");
  const [{ data: recipe }, lots, list] = await Promise.all([
    ctx.supabase
      .from("recipes")
      .select("id, name, recipe_ingredients(id, position, ingredient_key, display_name, quantity, unit, optional, note)")
      .eq("id", recipeId)
      .maybeSingle(),
    getInventoryForMatching(ctx),
    getDefaultList(ctx),
  ]);
  if (!recipe) return fail("not_found", "Recipe not found.");
  if (!list) return fail("not_found", "No shopping list found.");

  const normalized = {
    ...(recipe as RecipeRow),
    recipe_ingredients: (recipe as RecipeRow).recipe_ingredients.map((i) => ({
      ...i,
      quantity: i.quantity === null ? null : Number(i.quantity),
    })),
  };
  const match = matchRecipe(toRecipeInput(normalized), lots);
  const lines = missingIngredientsForShopping(match);
  for (const line of lines) {
    const ingredientMatch = match.ingredients.find((m) => m.ingredient.ingredientKey === line.ingredientKey);
    const productId = ingredientMatch?.productIds.length === 1 ? ingredientMatch.productIds[0] : null;
    const { error } = await ctx.supabase.rpc("upsert_shopping_item", {
      p_list_id: list.id,
      p_name: line.name,
      p_quantity: line.quantity,
      p_unit: line.unit,
      p_product_id: productId,
      p_source: "recipe",
      p_recipe_id: recipeId,
    });
    if (error) return dbFail(error);
  }
  revalidateApp();
  return ok(
    { added: lines.length },
    lines.length === 0 ? "You already have everything" : `Added ${lines.length} ${lines.length === 1 ? "ingredient" : "ingredients"}`,
  );
}

export async function completeShoppingAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  const parsed = completeShoppingSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const list = await getDefaultList(ctx);
  if (!list) return fail("not_found", "No shopping list found.");
  const { data, error } = await ctx.supabase.rpc("complete_shopping", {
    p_list_id: list.id,
    p_items: parsed.data.items.map((i) => ({
      item_id: i.itemId,
      location_id: i.locationId,
      expiry_date: i.expiryDate ?? null,
      total_price: i.price ?? null,
    })),
  });
  if (error) return dbFail(error);
  revalidateApp();
  const count = Number(data ?? 0);
  return ok({ count }, `${count} ${count === 1 ? "item" : "items"} added to inventory`);
}

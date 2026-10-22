import type { AppContext } from "./context";
import { num, type Category, type LocationRow } from "@/lib/types";

export async function listCategories(ctx: AppContext): Promise<Category[]> {
  const { data } = await ctx.supabase
    .from("categories")
    .select("id, name, icon, store_section, sort_order")
    .eq("household_id", ctx.household.id)
    .order("sort_order")
    .order("name");
  return (data ?? []) as Category[];
}

export async function listLocations(ctx: AppContext): Promise<LocationRow[]> {
  const { data } = await ctx.supabase
    .from("location_stock")
    .select("id, household_id, parent_id, name, kind, notes, sort_order, lot_count, product_count")
    .eq("household_id", ctx.household.id)
    .order("sort_order")
    .order("name");
  return (data ?? []).map((l: LocationRow) => ({ ...l, lot_count: num(l.lot_count), product_count: num(l.product_count) }));
}

export async function listBrands(ctx: AppContext): Promise<Array<{ id: string; name: string }>> {
  const { data } = await ctx.supabase
    .from("brands")
    .select("id, name")
    .eq("household_id", ctx.household.id)
    .order("name")
    .limit(500);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

/** Location rows shaped for the pure helpers in lib/domain/locations. */
export function toLocationNodes(rows: LocationRow[]) {
  return rows.map((l) => ({
    id: l.id,
    parentId: l.parent_id,
    name: l.name,
    kind: l.kind,
    sortOrder: l.sort_order,
    lotCount: l.lot_count,
    productCount: l.product_count,
  }));
}

/** Known ingredient keys from the recipe catalog, for the item form's suggestions. */
export async function listIngredientKeys(ctx: AppContext): Promise<string[]> {
  const { data } = await ctx.supabase.from("recipe_ingredients").select("ingredient_key").limit(1000);
  return [...new Set((data ?? []).map((r: { ingredient_key: string }) => r.ingredient_key))].sort();
}

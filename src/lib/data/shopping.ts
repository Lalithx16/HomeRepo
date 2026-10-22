import type { AppContext } from "./context";
import { num, type ShoppingItemRow } from "@/lib/types";

export async function getDefaultList(ctx: AppContext): Promise<{ id: string; name: string } | null> {
  const { data } = await ctx.supabase
    .from("shopping_lists")
    .select("id, name")
    .eq("household_id", ctx.household.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}

const ITEM_COLUMNS =
  "id, list_id, product_id, category_id, name, quantity, unit, notes, source, recipe_id, checked_at, removed_at, purchased_at, created_at, category:categories(name, store_section), product:products(default_unit, name)";

export async function listShoppingItems(
  ctx: AppContext,
  listId: string,
): Promise<{ open: ShoppingItemRow[]; removed: ShoppingItemRow[] }> {
  const [open, removed] = await Promise.all([
    ctx.supabase
      .from("shopping_list_items")
      .select(ITEM_COLUMNS)
      .eq("list_id", listId)
      .is("removed_at", null)
      .is("purchased_at", null)
      .order("created_at", { ascending: true })
      .limit(500),
    ctx.supabase
      .from("shopping_list_items")
      .select(ITEM_COLUMNS)
      .eq("list_id", listId)
      .not("removed_at", "is", null)
      .is("purchased_at", null)
      .order("removed_at", { ascending: false })
      .limit(20),
  ]);
  const norm = (r: ShoppingItemRow) => ({ ...r, quantity: num(r.quantity) });
  return { open: (open.data ?? []).map(norm), removed: (removed.data ?? []).map(norm) };
}

export async function countOpenShoppingItems(ctx: AppContext): Promise<number> {
  const { count } = await ctx.supabase
    .from("shopping_list_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", ctx.household.id)
    .is("removed_at", null)
    .is("purchased_at", null)
    .is("checked_at", null);
  return count ?? 0;
}

/** Product ids that already have an open line on the list (to avoid duplicate suggestions). */
export async function productsOnList(ctx: AppContext): Promise<Set<string>> {
  const { data } = await ctx.supabase
    .from("shopping_list_items")
    .select("product_id")
    .eq("household_id", ctx.household.id)
    .is("removed_at", null)
    .is("purchased_at", null)
    .not("product_id", "is", null);
  return new Set((data ?? []).map((r: { product_id: string }) => r.product_id));
}

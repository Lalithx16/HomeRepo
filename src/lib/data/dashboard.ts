import type { AppContext } from "./context";
import { listExpiringLots, listRestockProducts, getTransactions } from "./inventory";
import { countOpenShoppingItems } from "./shopping";

export async function getDashboardMetrics(ctx: AppContext) {
  const hid = ctx.household.id;
  const [products, inStock, expiring, shopping] = await Promise.all([
    ctx.supabase.from("product_stock").select("id", { count: "exact", head: true }).eq("household_id", hid),
    ctx.supabase.from("product_stock").select("id", { count: "exact", head: true }).eq("household_id", hid).gt("total_quantity", 0),
    ctx.supabase
      .from("lot_details")
      .select("id", { count: "exact", head: true })
      .eq("household_id", hid)
      .in("expiry_status", ["expired", "expiring"]),
    countOpenShoppingItems(ctx),
  ]);
  return {
    totalProducts: products.count ?? 0,
    inStock: inStock.count ?? 0,
    expiringLots: expiring.count ?? 0,
    shoppingOpen: shopping,
  };
}

export async function getAttention(ctx: AppContext) {
  const [lots, restock, recent] = await Promise.all([
    listExpiringLots(ctx, ctx.household.expiry_warning_days),
    listRestockProducts(ctx),
    getTransactions(ctx, { limit: 8 }),
  ]);
  return { lots, restock, recent };
}

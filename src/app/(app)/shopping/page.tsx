import { listCategories, listLocations, toLocationNodes } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { getDefaultList, listShoppingItems } from "@/lib/data/shopping";
import { locationPath } from "@/lib/domain/locations";
import { PageHeader } from "@/components/shared/page-header";
import { ShoppingList } from "@/components/shopping/shopping-list";

export const metadata = { title: "Shopping list" };

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const [ctx, params] = await Promise.all([requireContext(), searchParams]);
  const list = await getDefaultList(ctx);
  const [{ open, removed }, categories, locations, productsRes] = await Promise.all([
    list ? listShoppingItems(ctx, list.id) : Promise.resolve({ open: [], removed: [] }),
    listCategories(ctx),
    listLocations(ctx),
    ctx.supabase
      .from("products")
      .select("id, name, default_unit, category_id")
      .eq("household_id", ctx.household.id)
      .order("name")
      .limit(2000),
  ]);

  // Where each product was last stored, to pre-fill "Finish shopping".
  const productIds = [...new Set(open.map((i) => i.product_id).filter((id): id is string => !!id))];
  const defaultLocations: Record<string, string> = {};
  if (productIds.length) {
    const { data } = await ctx.supabase
      .from("inventory_lots")
      .select("product_id, location_id, updated_at")
      .in("product_id", productIds)
      .order("updated_at", { ascending: false });
    for (const row of (data ?? []) as Array<{ product_id: string; location_id: string }>) {
      defaultLocations[row.product_id] ??= row.location_id;
    }
  }
  const nodes = toLocationNodes(locations);
  const locationOptions = nodes.map((n) => ({ id: n.id, label: locationPath(nodes, n.id, " › ") })).sort((a, b) => a.label.localeCompare(b.label));
  const fallback = locations.find((l) => l.name.toLowerCase() === "pantry")?.id ?? locations[0]?.id ?? null;
  const toBuy = open.filter((i) => !i.checked_at).length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Shopping list"
        description={toBuy ? `${toBuy} ${toBuy === 1 ? "item" : "items"} to buy. Checking items off works offline.` : "Everything's in the cart."}
      />
      <ShoppingList
        items={open}
        removed={removed}
        categories={categories}
        products={(productsRes.data ?? []) as Array<{ id: string; name: string; default_unit: string; category_id: string | null }>}
        locations={locationOptions}
        defaultLocations={defaultLocations}
        fallbackLocationId={fallback}
        currency={ctx.household.currency}
        canEdit={ctx.canEdit}
        autoFocusAdd={params.add === "1"}
      />
    </div>
  );
}

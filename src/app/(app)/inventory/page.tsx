import { Boxes, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { listCategories, listLocations, toLocationNodes } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { INVENTORY_SORTS, listInventory, parseInventoryFilters, signImageUrls } from "@/lib/data/inventory";
import { locationPath } from "@/lib/domain/locations";
import { Button } from "@/components/ui/button";
import { InventoryToolbar } from "@/components/inventory/inventory-toolbar";
import { Pagination } from "@/components/inventory/pagination";
import { ProductCard } from "@/components/inventory/product-card";
import { ProductRow, ProductRowHeader } from "@/components/inventory/product-row";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Inventory" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const [ctx, raw] = await Promise.all([requireContext(), searchParams]);
  const filters = parseInventoryFilters(raw);
  const [categories, locations] = await Promise.all([listCategories(ctx), listLocations(ctx)]);
  const nodes = toLocationNodes(locations);
  const result = await listInventory(ctx, filters, nodes);
  const images = await signImageUrls(ctx, result.items.map((i) => i.image_path));
  const view = raw.view === "list" ? "list" : "grid";
  const hasFilters = Boolean(filters.q || filters.category || filters.location || filters.stock || filters.expiry);

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && k !== "page") qs.set(k, v);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `/inventory?${s}` : "/inventory";
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`${result.total} ${result.total === 1 ? "item" : "items"}${hasFilters ? " match your filters" : " tracked in this household"}.`}
        actions={
          ctx.canEdit ? (
            <Button asChild className="max-md:hidden">
              <Link href="/inventory/new">
                <Plus /> Add item
              </Link>
            </Button>
          ) : null
        }
      />
      <InventoryToolbar
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        locations={nodes
          .map((n) => ({ value: n.id, label: locationPath(nodes, n.id, " › ") }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        sorts={INVENTORY_SORTS}
      />

      {result.error ? (
        <EmptyState icon={SearchX} title="Couldn't load inventory" description={result.error} />
      ) : result.items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No items match"
            description="Try a different search or remove some filters."
            action={
              <Button asChild variant="secondary">
                <Link href="/inventory">Clear search and filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Boxes}
            title="Nothing tracked yet"
            description="Add the first thing in your pantry or fridge. You can record brand, quantity, location and expiry."
            action={
              ctx.canEdit ? (
                <Button asChild>
                  <Link href="/inventory/new">
                    <Plus /> Add your first item
                  </Link>
                </Button>
              ) : null
            }
          />
        )
      ) : view === "grid" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} imageUrl={p.image_path ? images[p.image_path] : null} today={ctx.today} canEdit={ctx.canEdit} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <ProductRowHeader />
          <ul className="divide-y divide-border">
            {result.items.map((p) => (
              <ProductRow key={p.id} product={p} imageUrl={p.image_path ? images[p.image_path] : null} today={ctx.today} canEdit={ctx.canEdit} />
            ))}
          </ul>
        </div>
      )}

      <Pagination page={filters.page ?? 1} total={result.total} pageSize={result.pageSize} hrefFor={hrefFor} />
    </>
  );
}

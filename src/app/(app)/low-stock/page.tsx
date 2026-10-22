import { PackageCheck, Settings2 } from "lucide-react";
import Link from "next/link";
import { requireContext } from "@/lib/data/context";
import { listRestockProducts, signImageUrls } from "@/lib/data/inventory";
import { productsOnList } from "@/lib/data/shopping";
import { suggestedRestock } from "@/lib/domain/stock";
import { Card } from "@/components/ui/card";
import { AddAllLowStockButton, AddToListButton } from "@/components/inventory/add-to-list-button";
import { ProductImage } from "@/components/inventory/product-image";
import { QuantityStepper } from "@/components/offline/quantity-stepper";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { QuantityText } from "@/components/shared/quantity";
import { StockBadge } from "@/components/shared/status";

export const metadata = { title: "Low stock" };

export default async function LowStockPage() {
  const ctx = await requireContext();
  const [products, onList] = await Promise.all([listRestockProducts(ctx), productsOnList(ctx)]);
  const images = await signImageUrls(ctx, products.map((p) => p.image_path));
  const pendingAdds = products.filter((p) => !onList.has(p.id)).length;
  const multiplier = ctx.household.restock_multiplier;

  return (
    <>
      <PageHeader
        title="Low stock"
        description={`Items below the minimum you set. Suggestions refill to the item's target, or ${multiplier}× the minimum.`}
        actions={ctx.canEdit && products.length ? <AddAllLowStockButton disabled={pendingAdds === 0} /> : null}
      />
      {products.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          tone="success"
          title="Everything is stocked"
          description="Nothing is below its minimum. Set a minimum on any item to get low-stock alerts."
          action={
            <Link href="/inventory" className="text-sm font-medium text-primary hover:underline">
              Browse inventory
            </Link>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {products.map((p) => {
              const suggestion = suggestedRestock(
                p.total_quantity,
                p.min_quantity != null ? { minQuantity: p.min_quantity, targetQuantity: p.target_quantity } : null,
                p.default_unit,
                multiplier,
              );
              return (
                <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ProductImage src={p.image_path ? images[p.image_path] : null} icon={p.category_icon} alt={p.name} size="md" />
                    <div className="min-w-0">
                      <Link href={`/inventory/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <StockBadge status={p.stock_status === "ok" ? "low" : p.stock_status} />
                        <span>
                          Have <QuantityText quantity={p.total_quantity} unit={p.default_unit} className="font-medium text-foreground" />
                        </span>
                        <span>
                          Min <QuantityText quantity={p.min_quantity ?? 0} unit={p.default_unit} />
                        </span>
                        <span>
                          Buy <QuantityText quantity={suggestion} unit={p.default_unit} className="font-medium text-foreground" />
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    {p.single_lot_id && p.single_lot_unit && p.single_lot_quantity !== null ? (
                      <QuantityStepper lotId={p.single_lot_id} productId={p.id} label={p.name} quantity={p.single_lot_quantity} unit={p.single_lot_unit} canEdit={ctx.canEdit} size="sm" />
                    ) : (
                      <span />
                    )}
                    {ctx.canEdit ? <AddToListButton productId={p.id} quantity={suggestion} onList={onList.has(p.id)} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <Settings2 className="size-3.5" aria-hidden />
            Change the restock multiplier in{" "}
            <Link href="/settings" className="font-medium text-primary hover:underline">
              Settings
            </Link>
          </div>
        </Card>
      )}
    </>
  );
}

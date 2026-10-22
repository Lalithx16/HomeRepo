import Link from "next/link";
import { describeExpiry } from "@/lib/domain/expiry";
import type { ProductStockRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ExpiryBadge, StockBadge } from "@/components/shared/status";
import { QuantityText } from "@/components/shared/quantity";
import { QuantityStepper } from "@/components/offline/quantity-stepper";
import { ProductActions } from "./product-actions";
import { ProductImage } from "./product-image";

interface Props {
  product: ProductStockRow;
  imageUrl?: string | null;
  today: string;
  canEdit: boolean;
}

/** Dense row: a table-like grid on desktop, a readable stacked row on phones. */
export function ProductRow({ product: p, imageUrl, today, canEdit }: Props) {
  return (
    <li className="relative grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-hover md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_9rem_minmax(0,1.2fr)_auto] md:gap-x-4">
      <ProductImage src={imageUrl} icon={p.category_icon} alt={p.name} size="md" />
      <div className="min-w-0">
        <Link href={`/inventory/${p.id}`} className="block truncate text-sm font-medium after:absolute after:inset-0">
          {p.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {p.brand_name ?? <span className="md:hidden">{p.category_name ?? "Uncategorized"}</span>}
          <span className="md:hidden">{p.brand_name ? ` · ${p.category_name ?? "Uncategorized"}` : ""}</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5 md:hidden">
          <StockBadge status={p.stock_status} />
          <ExpiryBadge status={p.expiry_status} date={p.earliest_expiry} today={today} />
        </div>
      </div>
      <span className="hidden truncate text-sm text-muted-foreground md:block">{p.category_name ?? "Uncategorized"}</span>
      <span className="hidden truncate text-sm text-muted-foreground md:block">
        {p.location_ids.length > 1 ? `${p.location_ids.length} locations` : p.location_names ?? "—"}
      </span>
      <div className="relative z-10 hidden md:block">
        {p.single_lot_id && p.single_lot_unit && p.single_lot_quantity !== null ? (
          <QuantityStepper lotId={p.single_lot_id} productId={p.id} label={p.name} quantity={p.single_lot_quantity} unit={p.single_lot_unit} canEdit={canEdit} size="sm" />
        ) : (
          <QuantityText quantity={p.total_quantity} unit={p.default_unit} className="text-sm font-medium" />
        )}
      </div>
      <div className="hidden flex-wrap gap-1.5 md:flex">
        <StockBadge status={p.stock_status} />
        {p.expiry_status === "expired" || p.expiry_status === "expiring" ? (
          <ExpiryBadge status={p.expiry_status} date={p.earliest_expiry} today={today} />
        ) : (
          <span className={cn("text-xs text-muted-foreground")}>{p.earliest_expiry ? describeExpiry(p.earliest_expiry, today) : "No expiry"}</span>
        )}
      </div>
      <div className="relative z-10 flex items-center gap-1">
        <span className="text-right text-sm font-medium md:hidden">
          <QuantityText quantity={p.total_quantity} unit={p.default_unit} />
        </span>
        <ProductActions product={p} canEdit={canEdit} />
      </div>
    </li>
  );
}

export function ProductRowHeader() {
  return (
    <div className="hidden grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_9rem_minmax(0,1.2fr)_auto] gap-x-4 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid" aria-hidden>
      <span className="w-11" />
      <span>Item</span>
      <span>Category</span>
      <span>Location</span>
      <span>Quantity</span>
      <span>Status</span>
      <span className="w-8" />
    </div>
  );
}

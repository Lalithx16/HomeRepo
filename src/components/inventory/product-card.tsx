import { MapPin } from "lucide-react";
import Link from "next/link";
import type { ProductStockRow } from "@/lib/types";
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

function locationSummary(p: ProductStockRow): string {
  if (p.location_ids.length > 1) return `${p.location_ids.length} locations`;
  return p.location_names ?? "No location";
}

export function ProductCard({ product: p, imageUrl, today, canEdit }: Props) {
  return (
    <article className="relative flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <ProductImage src={imageUrl} icon={p.category_icon} alt={p.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] leading-snug font-semibold">
            <Link href={`/inventory/${p.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
              {p.name}
            </Link>
          </h3>
          <p className="truncate text-[13px] text-muted-foreground">
            {[p.brand_name, p.category_name ?? "Uncategorized"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="relative z-10 -mt-1 -mr-1">
          <ProductActions product={p} canEdit={canEdit} />
        </div>
      </div>

      <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
        <StockBadge status={p.stock_status} />
        <ExpiryBadge status={p.expiry_status} date={p.earliest_expiry} today={today} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2 border-t border-border pt-3">
        <span className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{locationSummary(p)}</span>
        </span>
        {p.single_lot_id && p.single_lot_unit && p.single_lot_quantity !== null ? (
          <div className="relative z-10">
            <QuantityStepper
              lotId={p.single_lot_id}
              productId={p.id}
              label={p.name}
              quantity={p.single_lot_quantity}
              unit={p.single_lot_unit}
              canEdit={canEdit}
              size="sm"
            />
          </div>
        ) : (
          <span className="shrink-0 text-right text-sm font-semibold">
            <QuantityText quantity={p.total_quantity} unit={p.default_unit} />
            <span className="block text-[11px] font-normal text-muted-foreground">{p.lot_count} batches</span>
          </span>
        )}
      </div>
    </article>
  );
}

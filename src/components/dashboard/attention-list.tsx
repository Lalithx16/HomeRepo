import { ChevronRight, PartyPopper } from "lucide-react";
import Link from "next/link";
import type { LotDetailRow, ProductStockRow } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { ExpiryBadge, StockBadge } from "@/components/shared/status";
import { IconTile } from "@/components/shared/icons";
import { QuantityText } from "@/components/shared/quantity";

type Entry =
  | { kind: "lot"; key: string; priority: number; lot: LotDetailRow }
  | { kind: "restock"; key: string; priority: number; product: ProductStockRow };

/** Expired first, then expiring soonest, then out-of-stock, then low stock. */
export function AttentionList({ lots, restock, today }: { lots: LotDetailRow[]; restock: ProductStockRow[]; today: string }) {
  const entries: Entry[] = [
    ...lots.map((lot) => ({
      kind: "lot" as const,
      key: `l-${lot.id}`,
      priority: lot.expiry_status === "expired" ? 0 : 1 + (lot.days_until_expiry ?? 0) / 100,
      lot,
    })),
    ...restock.map((product) => ({
      kind: "restock" as const,
      key: `p-${product.id}`,
      priority: product.stock_status === "out" ? 2 : 3,
      product,
    })),
  ]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 7);

  const more = lots.length + restock.length - entries.length;

  return (
    <Card>
      <CardHeader
        title="Needs attention"
        description={entries.length ? "Expired, expiring and low items, most urgent first." : undefined}
      />
      {entries.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
          <span className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success">
            <PartyPopper className="size-4" aria-hidden />
          </span>
          Nothing needs attention. Everything is stocked and fresh.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {entries.map((entry) =>
            entry.kind === "lot" ? (
              <li key={entry.key}>
                <Link href={`/inventory/${entry.lot.product_id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                  <IconTile icon={entry.lot.category_icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.lot.product_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <QuantityText quantity={entry.lot.quantity} unit={entry.lot.unit} /> · {entry.lot.location_name}
                    </p>
                  </div>
                  <ExpiryBadge status={entry.lot.expiry_status} date={entry.lot.expiry_date} today={today} />
                  <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                </Link>
              </li>
            ) : (
              <li key={entry.key}>
                <Link href={`/inventory/${entry.product.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                  <IconTile icon={entry.product.category_icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <QuantityText quantity={entry.product.total_quantity} unit={entry.product.default_unit} /> left · keep{" "}
                      <QuantityText quantity={entry.product.min_quantity ?? 0} unit={entry.product.default_unit} />
                    </p>
                  </div>
                  <StockBadge status={entry.product.stock_status === "ok" ? "low" : entry.product.stock_status} />
                  <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
      {more > 0 ? (
        <div className="flex gap-4 border-t border-border px-5 py-3 text-sm">
          <Link href="/expiring" className="font-medium text-primary hover:underline">
            All expiring
          </Link>
          <Link href="/low-stock" className="font-medium text-primary hover:underline">
            All low stock
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

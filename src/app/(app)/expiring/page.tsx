import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { requireContext } from "@/lib/data/context";
import { listExpiringLots, signImageUrls } from "@/lib/data/inventory";
import { formatDate } from "@/lib/domain/expiry";
import type { LotDetailRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { LotQuickActions } from "@/components/inventory/lot-quick-actions";
import { ProductImage } from "@/components/inventory/product-image";
import { QuantityStepper } from "@/components/offline/quantity-stepper";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ExpiryBadge } from "@/components/shared/status";

export const metadata = { title: "Expiring soon" };

const RANGES = [7, 14, 30] as const;

export default async function ExpiringPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const [ctx, params] = await Promise.all([requireContext(), searchParams]);
  const requested = Number(params.days);
  const days = RANGES.includes(requested as (typeof RANGES)[number]) ? requested : Math.max(ctx.household.expiry_warning_days, 7);
  const lots = await listExpiringLots(ctx, days);
  const images = await signImageUrls(ctx, lots.map((l) => l.image_path));
  const expired = lots.filter((l) => l.expiry_status === "expired");
  const upcoming = lots.filter((l) => l.expiry_status !== "expired");

  const renderLot = (lot: LotDetailRow) => (
    <li key={lot.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProductImage src={lot.image_path ? images[lot.image_path] : null} icon={lot.category_icon} alt={lot.product_name} size="md" />
        <div className="min-w-0">
          <Link href={`/inventory/${lot.product_id}`} className="block truncate text-sm font-medium hover:underline">
            {lot.product_name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <ExpiryBadge status={lot.expiry_status} date={lot.expiry_date} today={ctx.today} showFresh />
            <span>
              {lot.expiry_date ? formatDate(lot.expiry_date) : ""} · {lot.location_name}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <QuantityStepper lotId={lot.id} productId={lot.product_id} label={lot.product_name} quantity={lot.quantity} unit={lot.unit} canEdit={ctx.canEdit} size="sm" />
        {ctx.canEdit ? <LotQuickActions lot={lot} /> : null}
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        title="Expiring soon"
        description="Use these first. Items without an expiry date never appear here."
        actions={
          <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-card" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/expiring?days=${r}`}
                aria-current={days === r ? "true" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-3 text-sm sm:h-8",
                  days === r ? "bg-surface-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r} days
              </Link>
            ))}
          </div>
        }
      />
      {lots.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          tone="success"
          title="Nothing expiring"
          description={`No batches expire in the next ${days} days. Nice work keeping things fresh.`}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {expired.length ? (
            <Card className="border-critical/25">
              <CardHeader title={`Expired (${expired.length})`} description="Past their date — check them, then use or discard." />
              <ul className="mt-2 divide-y divide-border">{expired.map(renderLot)}</ul>
            </Card>
          ) : null}
          {upcoming.length ? (
            <Card>
              <CardHeader title={`Next ${days} days (${upcoming.length})`} description="Soonest first." />
              <ul className="mt-2 divide-y divide-border">{upcoming.map(renderLot)}</ul>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}

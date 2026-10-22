import { BarChart3, Info } from "lucide-react";
import { getAnalytics } from "@/lib/data/analytics";
import { listLocations } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { getTransactions } from "@/lib/data/inventory";
import { formatCurrency, formatMonth } from "@/lib/domain/format";
import { TRANSACTION_LABEL, type TransactionKind } from "@/lib/domain/transactions";
import { Card, CardHeader } from "@/components/ui/card";
import { BarList } from "@/components/analytics/bar-list";
import { TransactionList } from "@/components/dashboard/recent-activity";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Analytics" };

const MIN_PRICED_PURCHASES = 3;

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="tabular mt-2 text-[26px] leading-none font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function AnalyticsPage() {
  const ctx = await requireContext();
  const [data, recent, locations] = await Promise.all([getAnalytics(ctx), getTransactions(ctx, { limit: 15 }), listLocations(ctx)]);
  if (!data) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState icon={BarChart3} title="Analytics unavailable" description="We couldn't load analytics right now. Please try again." />
      </>
    );
  }
  const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const e = data.expiry_buckets;
  const enoughSpending = data.spending.priced_purchases >= MIN_PRICED_PURCHASES;
  const totalSpend = data.spending.by_month.reduce((s, m) => s + m.value, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Counts come from your current inventory; activity and spending come from your recorded history."
      />
      {data.totals.products === 0 ? (
        <EmptyState icon={BarChart3} title="Nothing to analyze yet" description="Add a few items and use them for a while — insights will appear here." />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Inventory totals">
            <Stat label="Tracked items" value={data.totals.products} />
            <Stat label="In stock" value={data.totals.in_stock} />
            <Stat label="Below minimum" value={data.totals.needs_restock} hint={`${data.totals.with_rule} items have a minimum set`} />
            <Stat label="Out of stock" value={data.totals.out} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Items by category" description="In-stock items only." />
              <div className="p-4 sm:px-5">
                <BarList
                  label="Items by category"
                  data={data.by_category.slice(0, 12).map((d) => ({ label: d.label, value: d.value }))}
                  format={(v) => `${v}`}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Items by location" description="Where things are stored right now." />
              <div className="p-4 sm:px-5">
                <BarList
                  label="Items by location"
                  data={data.by_location.slice(0, 12).map((d) => ({ label: d.label, value: d.value, href: `/locations/${d.id}` }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Upcoming expiries" description={`Batches in stock, as of ${data.today}.`} />
              <div className="p-4 sm:px-5">
                <BarList
                  label="Upcoming expiries"
                  data={[
                    { label: "Expired", value: e.expired, tone: "critical", href: "/expiring" },
                    { label: "Within 3 days", value: e.next_3, tone: "warning", href: "/expiring?days=7" },
                    { label: "4–7 days", value: e.next_7, tone: "warning", href: "/expiring?days=7" },
                    { label: "8–30 days", value: e.next_30, tone: "info", href: "/expiring?days=30" },
                    { label: "Later", value: e.later, tone: "neutral" },
                    { label: "No expiry date", value: e.no_expiry, tone: "neutral" },
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Spending"
                description={enoughSpending ? `${formatCurrency(totalSpend, ctx.household.currency)} recorded over the last 6 months.` : undefined}
              />
              <div className="p-4 sm:px-5">
                {enoughSpending ? (
                  <BarList
                    label="Spending by month"
                    data={data.spending.by_month.map((m) => ({ label: formatMonth(m.month), value: m.value }))}
                    format={(v) => formatCurrency(v, ctx.household.currency)}
                  />
                ) : (
                  <p className="flex gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Add a price when you add stock or finish shopping. Spending appears once at least {MIN_PRICED_PURCHASES} purchases have prices (
                    {data.spending.priced_purchases} so far).
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Activity in the last 30 days" description="From your inventory history." />
              <div className="p-4 sm:px-5">
                <BarList
                  label="Activity by type"
                  data={data.activity_30d.map((a) => ({ label: TRANSACTION_LABEL[a.kind as TransactionKind] ?? a.kind, value: a.value, tone: "info" }))}
                  emptyText="No changes recorded in the last 30 days."
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Most used (30 days)" description="How often each item was used." />
              <div className="p-4 sm:px-5">
                <BarList label="Most used items" data={data.top_consumed_30d} emptyText="Use items with the minus button or “Use” to see this." />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent inventory changes" />
            <div className="mt-2">
              <TransactionList transactions={recent} locationNames={locationNames} />
            </div>
          </Card>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Homebase doesn&apos;t yet store daily stock snapshots, so it shows current low-stock counts rather than trends over time.
          </p>
        </div>
      )}
    </>
  );
}

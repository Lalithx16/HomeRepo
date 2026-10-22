import { ArrowRight, Boxes, CalendarClock, ChefHat, ListPlus, PackageMinus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { getAttention, getDashboardMetrics } from "@/lib/data/dashboard";
import { listLocations, toLocationNodes } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { getMatchedRecipes } from "@/lib/data/recipes";
import { buildLocationTree, flattenTree } from "@/lib/domain/locations";
import { greeting, pluralize } from "@/lib/domain/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { AttentionList } from "@/components/dashboard/attention-list";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TransactionList } from "@/components/dashboard/recent-activity";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LocationIcon } from "@/components/shared/icons";
import { LoadSampleButton } from "@/components/settings/load-sample-button";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const ctx = await requireContext();
  const [metrics, attention, locations, recipes] = await Promise.all([
    getDashboardMetrics(ctx),
    getAttention(ctx),
    listLocations(ctx),
    getMatchedRecipes(ctx),
  ]);

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: ctx.household.timezone }).format(new Date()),
  );
  const firstName = ctx.displayName?.split(" ")[0];
  const nodes = flattenTree(buildLocationTree(toLocationNodes(locations)));
  const shortcuts = nodes
    .filter((n) => n.kind === "storage" || n.kind === "drawer" || (n.kind === "room" && n.children.length === 0))
    .sort((a, b) => b.totalProductCount - a.totalProductCount || a.name.localeCompare(b.name))
    .slice(0, 6);
  const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const suggestions = recipes.filter((r) => r.match.availability !== "unavailable").slice(0, 3);
  const restockCount = attention.restock.length;
  const expiredCount = attention.lots.filter((l) => l.expiry_status === "expired").length;

  const summary =
    metrics.totalProducts === 0
      ? "Your inventory is empty. Add your first item to get started."
      : [
          `${pluralize(metrics.inStock, "item")} in stock`,
          expiredCount > 0 ? `${expiredCount} expired` : null,
          metrics.expiringLots - expiredCount > 0 ? `${metrics.expiringLots - expiredCount} expiring soon` : null,
          restockCount > 0 ? `${restockCount} to restock` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted-foreground">{ctx.household.name}</p>
        <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">
          {greeting(hour)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{summary}</p>
      </header>

      {metrics.totalProducts === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Let's stock your Homebase"
          description="Add what's in your pantry, fridge and cupboards. Homebase will track quantities, expiry dates and what to buy next."
          action={
            ctx.canEdit ? (
              <>
                <Button asChild>
                  <Link href="/inventory/new">
                    <Plus /> Add your first item
                  </Link>
                </Button>
                <LoadSampleButton />
              </>
            ) : null
          }
        />
      ) : null}

      <section aria-label="Overview metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Tracked items" value={metrics.totalProducts} detail={`${metrics.inStock} in stock`} icon={Boxes} href="/inventory" />
        <MetricCard
          label="Low stock"
          value={restockCount}
          detail={restockCount ? "Below your minimum" : "All above minimum"}
          icon={PackageMinus}
          href="/low-stock"
          tone={restockCount ? "warning" : "neutral"}
        />
        <MetricCard
          label="Expiring soon"
          value={metrics.expiringLots}
          detail={expiredCount ? `${expiredCount} already expired` : `Within ${ctx.household.expiry_warning_days} days`}
          icon={CalendarClock}
          href="/expiring"
          tone={expiredCount ? "critical" : metrics.expiringLots ? "warning" : "neutral"}
        />
        <MetricCard
          label="Shopping list"
          value={metrics.shoppingOpen}
          detail={metrics.shoppingOpen ? "Items to buy" : "Nothing to buy"}
          icon={ShoppingCart}
          href="/shopping"
          tone={metrics.shoppingOpen ? "primary" : "neutral"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AttentionList lots={attention.lots} restock={attention.restock} today={ctx.today} />
          <Card>
            <CardHeader
              title="Recently updated"
              action={
                <Link href="/analytics" className="text-[13px] font-medium text-primary hover:underline">
                  Activity
                </Link>
              }
            />
            <div className="mt-2">
              <TransactionList transactions={attention.recent} locationNames={locationNames} emptyText="Changes you make will appear here." />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {ctx.canEdit ? (
            <Card>
              <CardHeader title="Quick actions" />
              <div className="grid grid-cols-2 gap-2 p-4 sm:px-5">
                <Button asChild variant="secondary" className="h-auto flex-col gap-1.5 py-3">
                  <Link href="/inventory/new">
                    <Plus /> Add item
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-auto flex-col gap-1.5 py-3">
                  <Link href="/inventory?sort=updated">
                    <Boxes /> Update stock
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-auto flex-col gap-1.5 py-3">
                  <Link href="/shopping?add=1">
                    <ListPlus /> Add to list
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-auto flex-col gap-1.5 py-3">
                  <Link href="/recipes?filter=ready">
                    <ChefHat /> What to cook
                  </Link>
                </Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Storage"
              action={
                <Link href="/locations" className="text-[13px] font-medium text-primary hover:underline">
                  All locations
                </Link>
              }
            />
            {shortcuts.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted-foreground">No locations yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 p-4 sm:px-5">
                {shortcuts.map((loc) => (
                  <li key={loc.id}>
                    <Link
                      href={`/locations/${loc.id}`}
                      className="flex h-full flex-col gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-surface-hover"
                    >
                      <LocationIcon kind={loc.kind} name={loc.name} className="size-[18px] text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{loc.name}</span>
                      <span className="text-xs text-muted-foreground">{pluralize(loc.totalProductCount, "item")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <section aria-labelledby="recipes-heading">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="recipes-heading" className="text-[15px] font-semibold tracking-tight">
              You could make
            </h2>
            <p className="text-[13px] text-muted-foreground">Based on what&apos;s in stock right now.</p>
          </div>
          <Link href="/recipes" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            All recipes <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {suggestions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-5 py-6 text-sm text-muted-foreground">
            Add a few staples like rice, eggs, onions or pasta to see recipe ideas.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {suggestions.map(({ recipe, match }) => (
              <RecipeCard key={recipe.id} recipe={recipe} match={match} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

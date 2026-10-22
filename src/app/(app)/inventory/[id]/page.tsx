import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listLocations, toLocationNodes } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { getProduct, getProductLots, getRatings, getTransactions, signImageUrls } from "@/lib/data/inventory";
import { describeExpiry } from "@/lib/domain/expiry";
import { locationPath } from "@/lib/domain/locations";
import { suggestedRestock } from "@/lib/domain/stock";
import { Card, CardHeader } from "@/components/ui/card";
import { TransactionList } from "@/components/dashboard/recent-activity";
import { LotList } from "@/components/inventory/lot-list";
import { ProductHeaderActions } from "@/components/inventory/product-header-actions";
import { ProductImage } from "@/components/inventory/product-image";
import { RatingPanel } from "@/components/inventory/rating-panel";
import { QuantityText } from "@/components/shared/quantity";
import { ExpiryBadge, StockBadge } from "@/components/shared/status";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: UUID.test(id) ? "Item" : "Not found" };
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-[17px] font-semibold tracking-tight">{children}</dd>
    </div>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx] = await Promise.all([params, requireContext()]);
  if (!UUID.test(id)) notFound();
  const product = await getProduct(ctx, id);
  if (!product) notFound();

  const [lots, history, locations, ratings, images] = await Promise.all([
    getProductLots(ctx, id),
    getTransactions(ctx, { productId: id, limit: 30 }),
    listLocations(ctx),
    getRatings(ctx, id, product.brand_id),
    signImageUrls(ctx, [product.image_path]),
  ]);
  const nodes = toLocationNodes(locations);
  const locationOptions = nodes
    .map((n) => ({ id: n.id, label: locationPath(nodes, n.id, " › ") }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const rule = product.min_quantity != null ? { minQuantity: product.min_quantity, targetQuantity: product.target_quantity } : null;
  const suggestion = suggestedRestock(product.total_quantity, rule, product.default_unit, ctx.household.restock_multiplier);
  const defaultLocation = lots[0]?.location_id ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/inventory" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Inventory
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="size-16 shrink-0 sm:size-20">
            <ProductImage src={product.image_path ? images[product.image_path] : null} icon={product.category_icon} alt={product.name} size="xl" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] leading-tight font-semibold tracking-tight sm:text-[28px]">{product.name}</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {[product.brand_name, product.category_name ?? "Uncategorized"].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <StockBadge status={product.stock_status} showOk />
              <ExpiryBadge status={product.expiry_status} date={product.earliest_expiry} today={ctx.today} />
            </div>
          </div>
        </div>
        <ProductHeaderActions
          product={product}
          locations={locationOptions}
          defaultLocationId={defaultLocation}
          currency={ctx.household.currency}
          canEdit={ctx.canEdit}
        />
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In stock">
          <QuantityText quantity={product.total_quantity} unit={product.default_unit} />
        </Stat>
        <Stat label="Minimum to keep">
          {product.min_quantity != null ? <QuantityText quantity={product.min_quantity} unit={product.default_unit} /> : <span className="text-muted-foreground">Not set</span>}
        </Stat>
        <Stat label="Suggested restock">
          {suggestion > 0 ? <QuantityText quantity={suggestion} unit={product.default_unit} /> : <span className="text-muted-foreground">None needed</span>}
        </Stat>
        <Stat label="Next expiry">
          <span className="text-[15px]">{product.earliest_expiry ? describeExpiry(product.earliest_expiry, ctx.today) : "No expiry"}</span>
        </Stat>
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Batches" description="Each batch has its own location, quantity and expiry date." />
            <div className="mt-2">
              <LotList lots={lots} today={ctx.today} canEdit={ctx.canEdit} locations={locationOptions} />
            </div>
          </Card>
          <Card>
            <CardHeader title="History" description="Every change to this item's stock." />
            <div className="mt-2">
              <TransactionList transactions={history} locationNames={locationNames} showProduct={false} emptyText="No history yet." />
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Ratings" description="Your household's personal reviews." />
            <div className="p-4 sm:px-5">
              <RatingPanel
                productId={product.id}
                productName={product.name}
                brandId={product.brand_id}
                brandName={product.brand_name}
                userId={ctx.user.id}
                productRatings={ratings.product}
                brandRatings={ratings.brand}
              />
            </div>
          </Card>
          {product.notes || product.ingredient_key ? (
            <Card>
              <CardHeader title="Details" />
              <dl className="flex flex-col gap-3 p-4 text-sm sm:px-5">
                {product.ingredient_key ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Recipe ingredient</dt>
                    <dd>{product.ingredient_key}</dd>
                  </div>
                ) : null}
                {product.notes ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-wrap">{product.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

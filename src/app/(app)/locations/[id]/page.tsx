import { ChevronRight, PackageOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listLocations, toLocationNodes } from "@/lib/data/catalog";
import { requireContext } from "@/lib/data/context";
import { normalizeLot, signImageUrls } from "@/lib/data/inventory";
import { pluralize } from "@/lib/domain/format";
import { buildLocationTree, flattenTree, getAncestors, getDescendantIds, locationPath } from "@/lib/domain/locations";
import type { LotDetailRow } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { ProductImage } from "@/components/inventory/product-image";
import { LocationPageActions } from "@/components/locations/location-manager";
import { LOCATION_KIND_LABEL } from "@/components/locations/location-form-dialog";
import { QuantityStepper } from "@/components/offline/quantity-stepper";
import { EmptyState } from "@/components/shared/empty-state";
import { LocationIcon } from "@/components/shared/icons";
import { ExpiryBadge } from "@/components/shared/status";

export const metadata = { title: "Location" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx] = await Promise.all([params, requireContext()]);
  if (!UUID.test(id)) notFound();
  const locations = await listLocations(ctx);
  const nodes = toLocationNodes(locations);
  const current = nodes.find((n) => n.id === id);
  if (!current) notFound();

  const tree = buildLocationTree(nodes);
  const node = flattenTree(tree).find((n) => n.id === id)!;
  const ancestors = getAncestors(nodes, id);
  const scope = getDescendantIds(nodes, id);

  const { data } = await ctx.supabase
    .from("lot_details")
    .select("*")
    .eq("household_id", ctx.household.id)
    .in("location_id", scope)
    .order("product_name")
    .limit(500);
  const lots: LotDetailRow[] = (data ?? []).map(normalizeLot);
  const images = await signImageUrls(ctx, lots.map((l) => l.image_path));
  const here = lots.filter((l) => l.location_id === id);
  const nested = lots.filter((l) => l.location_id !== id);
  const all = nodes.map((n) => ({ id: n.id, parentId: n.parentId, name: n.name, kind: n.kind }));
  const moveTargets = nodes.map((n) => ({ id: n.id, label: locationPath(nodes, n.id, " › ") })).sort((a, b) => a.label.localeCompare(b.label));
  const pathOf = (locId: string) => locationPath(nodes, locId, " › ").split(" › ").slice(ancestors.length).join(" › ");

  const renderLot = (lot: LotDetailRow, showPath: boolean) => (
    <li key={lot.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <ProductImage src={lot.image_path ? images[lot.image_path] : null} icon={lot.category_icon} alt={lot.product_name} size="md" />
      <div className="min-w-0 flex-1">
        <Link href={`/inventory/${lot.product_id}`} className="block truncate text-sm font-medium hover:underline">
          {lot.product_name}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showPath ? <span>{pathOf(lot.location_id)}</span> : lot.brand_name ? <span>{lot.brand_name}</span> : null}
          <ExpiryBadge status={lot.expiry_status} date={lot.expiry_date} today={ctx.today} />
        </div>
      </div>
      <QuantityStepper lotId={lot.id} productId={lot.product_id} label={lot.product_name} quantity={lot.quantity} unit={lot.unit} canEdit={ctx.canEdit} size="sm" />
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link href="/locations" className="hover:text-foreground">
              Locations
            </Link>
          </li>
          {ancestors.map((a, i) => (
            <li key={a.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" aria-hidden />
              {i === ancestors.length - 1 ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {a.name}
                </span>
              ) : (
                <Link href={`/locations/${a.id}`} className="hover:text-foreground">
                  {a.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
            <LocationIcon kind={current.kind} name={current.name} className="size-6" />
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{current.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {LOCATION_KIND_LABEL[current.kind as keyof typeof LOCATION_KIND_LABEL]?.split(" (")[0] ?? "Location"} · {pluralize(node.totalProductCount, "item")}
            </p>
          </div>
        </div>
        {ctx.canEdit ? (
          <LocationPageActions location={{ id: current.id, parentId: current.parentId, name: current.name, kind: current.kind, notes: locations.find((l) => l.id === id)?.notes ?? null }} all={all} moveTargets={moveTargets} hasLots={here.length > 0} />
        ) : null}
      </header>

      {node.children.length ? (
        <section aria-labelledby="inside-heading">
          <h2 id="inside-heading" className="mb-3 text-[15px] font-semibold tracking-tight">
            Inside {current.name}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {node.children.map((child) => (
              <li key={child.id}>
                <Link href={`/locations/${child.id}`} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
                  <LocationIcon kind={child.kind} name={child.name} className="size-5 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{child.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {pluralize(child.totalProductCount, "item")}
                    {child.children.length ? ` · ${child.children.length} inside` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lots.length === 0 ? (
        <EmptyState icon={PackageOpen} title="Nothing stored here yet" description="Add an item and choose this location, or move items here from their detail page." />
      ) : (
        <>
          {here.length ? (
            <Card>
              <CardHeader title={`Stored in ${current.name}`} description={pluralize(here.length, "batch", "batches")} />
              <ul className="mt-2 divide-y divide-border">{here.map((l) => renderLot(l, false))}</ul>
            </Card>
          ) : null}
          {nested.length ? (
            <Card>
              <CardHeader title="In sub-locations" description={pluralize(nested.length, "batch", "batches")} />
              <ul className="mt-2 divide-y divide-border">{nested.map((l) => renderLot(l, true))}</ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

"use client";

import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";

export interface FilterOption {
  value: string;
  label: string;
}

interface ToolbarProps {
  categories: FilterOption[];
  locations: FilterOption[];
  sorts: FilterOption[];
}

const STOCK: FilterOption[] = [
  { value: "ok", label: "In stock" },
  { value: "restock", label: "Below minimum" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];
const EXPIRY: FilterOption[] = [
  { value: "expired", label: "Expired" },
  { value: "expiring", label: "Expiring soon" },
  { value: "fresh", label: "Fresh" },
  { value: "none", label: "No expiry date" },
];

const FILTER_KEYS = ["category", "location", "stock", "expiry"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

/** URL-driven search, filters, sort and view controls (shareable, back-button friendly). */
export function InventoryToolbar({ categories, locations, sorts }: ToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const update = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in changes)) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  // Debounced search-as-you-type.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query.trim() === current) return;
    const t = window.setTimeout(() => update({ q: query.trim() || null }), 250);
    return () => window.clearTimeout(t);
  }, [query, params, update]);

  const view = params.get("view") === "list" ? "list" : "grid";
  const options: Record<FilterKey, { label: string; items: FilterOption[] }> = {
    category: { label: "Category", items: categories },
    location: { label: "Location", items: locations },
    stock: { label: "Stock", items: STOCK },
    expiry: { label: "Expiry", items: EXPIRY },
  };
  const active = FILTER_KEYS.flatMap((key) => {
    const value = params.get(key);
    if (!value) return [];
    const label = options[key].items.find((o) => o.value === value)?.label ?? value;
    return [{ key, label: `${options[key].label}: ${label}` }];
  });

  const selects = (layout: "inline" | "stacked") =>
    FILTER_KEYS.map((key) => (
      <div key={key} className={cn(layout === "stacked" ? "flex flex-col gap-1.5" : "w-40 xl:w-44")}>
        <label htmlFor={`filter-${key}-${layout}`} className={cn(layout === "stacked" ? "text-[13px] font-medium" : "sr-only")}>
          {options[key].label}
        </label>
        <NativeSelect
          id={`filter-${key}-${layout}`}
          value={params.get(key) ?? ""}
          onChange={(e) => update({ [key]: e.target.value || null })}
          className={layout === "inline" ? "h-9 text-sm" : undefined}
        >
          <option value="">{layout === "inline" ? `${options[key].label}: All` : "All"}</option>
          {options[key].items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    ));

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, brand, category or location"
            aria-label="Search inventory"
            className="pl-9"
            enterKeyHint="search"
          />
        </div>
        <Button variant="secondary" size="md" className="lg:hidden" onClick={() => setSheetOpen(true)} aria-label="Filters and sort">
          <SlidersHorizontal />
          <span className="max-sm:sr-only">Filters</span>
          {active.length ? <span className="tabular rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{active.length}</span> : null}
        </Button>
        <div className="hidden items-center gap-2 lg:flex">
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <NativeSelect id="sort" value={params.get("sort") ?? "updated"} onChange={(e) => update({ sort: e.target.value })} className="h-10 w-44 text-sm">
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5 shadow-card" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => {
            const Icon = v === "grid" ? LayoutGrid : List;
            return (
              <button
                key={v}
                type="button"
                onClick={() => update({ view: v === "grid" ? null : "list", page: params.get("page") })}
                aria-pressed={view === v}
                aria-label={v === "grid" ? "Grid view" : "List view"}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-md transition-colors sm:size-9",
                  view === v ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-2 lg:flex">{selects("inline")}</div>

      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {active.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => update({ [f.key]: null })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface pr-2 pl-3 text-[13px] transition-colors hover:bg-surface-muted"
              aria-label={`Remove filter ${f.label}`}
            >
              {f.label}
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ category: null, location: null, stock: null, expiry: null })}
            className="h-8 px-2 text-[13px] font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent title="Filter & sort">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sort-mobile" className="text-[13px] font-medium">
                Sort by
              </label>
              <NativeSelect id="sort-mobile" value={params.get("sort") ?? "updated"} onChange={(e) => update({ sort: e.target.value })}>
                {sorts.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {selects("stacked")}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => update({ category: null, location: null, stock: null, expiry: null })}>
              Reset filters
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Show results</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

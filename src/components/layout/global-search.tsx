"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { ArrowRight, Boxes, Loader2, MapPin, Plus, Search, ShoppingCart, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { formatQuantity } from "@/lib/domain/units";
import type { SearchResults } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LocationIcon } from "@/components/shared/icons";

const EMPTY: SearchResults = { products: [], locations: [], categories: [] };

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const itemClass =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[selected=true]:bg-surface-muted sm:min-h-11";

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  const [state, setState] = React.useState<"idle" | "loading" | "error" | "offline">("idle");
  const debounced = useDebounced(query.trim(), 180);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  React.useEffect(() => {
    if (!debounced) {
      setResults(EMPTY);
      setState("idle");
      return;
    }
    if (!navigator.onLine) {
      setState("offline");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()) as SearchResults);
        setState("idle");
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, [debounced]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const hasResults = results.products.length + results.locations.length + results.categories.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[100dvh] w-full flex-col overflow-hidden border-border bg-surface shadow-raised outline-none data-[state=open]:animate-pop-in sm:top-[12vh] sm:max-h-[70vh] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-2xl sm:border"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search inventory</DialogPrimitive.Title>
          <Command shouldFilter={false} label="Search inventory" className="flex min-h-0 flex-1 flex-col pt-safe">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search items, brands, categories, locations…"
                className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-subtle-foreground sm:text-[15px]"
                autoFocus
              />
              {state === "loading" ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" /> : null}
              <DialogPrimitive.Close className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-muted sm:border sm:border-border">
                <span className="sm:hidden">Cancel</span>
                <span className="hidden sm:inline">Esc</span>
              </DialogPrimitive.Close>
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
              {!debounced ? (
                <Command.Group heading="Quick actions" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                  <Command.Item value="add-item" onSelect={() => go("/inventory/new")} className={itemClass}>
                    <Plus className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-foreground">Add an item</span>
                  </Command.Item>
                  <Command.Item value="inventory" onSelect={() => go("/inventory")} className={itemClass}>
                    <Boxes className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-foreground">Browse inventory</span>
                  </Command.Item>
                  <Command.Item value="shopping" onSelect={() => go("/shopping")} className={itemClass}>
                    <ShoppingCart className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-foreground">Open shopping list</span>
                  </Command.Item>
                </Command.Group>
              ) : state === "offline" ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Search needs a connection. You&apos;re offline right now.</p>
              ) : state === "error" ? (
                <p className="px-3 py-8 text-center text-sm text-critical" role="alert">
                  Search failed. Check your connection and try again.
                </p>
              ) : !hasResults && state === "idle" ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No matches for “{debounced}”.</p>
                  <button type="button" onClick={() => go(`/inventory/new?name=${encodeURIComponent(debounced)}`)} className="mt-3 text-sm font-medium text-primary hover:underline">
                    Add “{debounced}” as a new item
                  </button>
                </div>
              ) : (
                <>
                  {results.products.length > 0 ? (
                    <Command.Group heading="Items" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                      {results.products.map((p) => (
                        <Command.Item key={p.id} value={`p-${p.id}`} onSelect={() => go(`/inventory/${p.id}`)} className={itemClass}>
                          <Boxes className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-foreground">{p.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[p.brand_name, p.category_name, p.location_names].filter(Boolean).join(" · ") || "No details"}
                            </span>
                          </span>
                          <span className={cn("tabular shrink-0 text-xs", Number(p.total_quantity) > 0 ? "text-muted-foreground" : "text-critical")}>
                            {Number(p.total_quantity) > 0 ? formatQuantity(Number(p.total_quantity), p.default_unit) : "Out"}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.locations.length > 0 ? (
                    <Command.Group heading="Locations" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                      {results.locations.map((l) => (
                        <Command.Item key={l.id} value={`l-${l.id}`} onSelect={() => go(`/locations/${l.id}`)} className={itemClass}>
                          <LocationIcon kind={l.kind} name={l.name} className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-foreground">{l.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{l.path}</span>
                          </span>
                          <ArrowRight className="size-4 text-subtle-foreground" aria-hidden />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {results.categories.length > 0 ? (
                    <Command.Group heading="Categories" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                      {results.categories.map((c) => (
                        <Command.Item key={c.id} value={`c-${c.id}`} onSelect={() => go(`/inventory?category=${c.id}`)} className={itemClass}>
                          <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                          <span className="tabular text-xs text-muted-foreground">{c.product_count} items</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              )}
            </Command.List>
            <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
              <span>↑↓ to navigate</span>
              <span>↵ to open</span>
              <span className="ml-auto flex items-center gap-1">
                <MapPin className="size-3" aria-hidden /> Searches this household only
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

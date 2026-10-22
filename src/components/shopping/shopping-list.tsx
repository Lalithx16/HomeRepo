"use client";

import { ChefHat, ListPlus, MoreHorizontal, PackageMinus, Pencil, Plus, RotateCcw, ShoppingBag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import {
  addLowStockToListAction,
  addShoppingItemAction,
  completeShoppingAction,
  purgeRemovedShoppingItemsAction,
  removeShoppingItemsAction,
  restoreShoppingItemAction,
  updateShoppingItemAction,
} from "@/lib/actions/shopping";
import { parseQuantityInput } from "@/lib/domain/quantity";
import { groupShoppingItems, shoppingProgress } from "@/lib/domain/shopping";
import { formatQuantity } from "@/lib/domain/units";
import type { Category, ShoppingItemRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { UnitSelect } from "@/components/shared/unit-select";
import { useOffline } from "@/components/offline/offline-provider";

export interface ProductOption {
  id: string;
  name: string;
  default_unit: string;
  category_id: string | null;
}

interface ShoppingListProps {
  items: ShoppingItemRow[];
  removed: ShoppingItemRow[];
  categories: Category[];
  products: ProductOption[];
  locations: Array<{ id: string; label: string }>;
  defaultLocations: Record<string, string>;
  fallbackLocationId: string | null;
  currency: string;
  canEdit: boolean;
  autoFocusAdd?: boolean;
}

type ViewItem = ShoppingItemRow & {
  checkedAt: string | null;
  storeSection: string | null;
  categoryName: string | null;
  productId: string | null;
  pendingToggle: boolean;
};

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (r: T) => void) =>
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.message) toast.success(result.message);
        onOk?.(result.data);
        router.refresh();
      } catch {
        toast.error("Couldn't reach Homebase. Check your connection.");
      }
    });
  return { pending, run };
}

function AddItemForm({ categories, products, autoFocus }: { categories: Category[]; products: ProductOption[]; autoFocus?: boolean }) {
  const [name, setName] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unit, setUnit] = React.useState("pcs");
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = useAction();
  const { online } = useOffline();
  const match = products.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  React.useEffect(() => {
    if (match) setUnit(match.default_unit);
  }, [match]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseQuantityInput(quantity);
    if (!name.trim()) return setError("Enter an item");
    if (q === null || q <= 0) return setError("Enter a quantity greater than zero");
    if (!online) return setError("Adding new items needs a connection. Checking items off works offline.");
    setError(null);
    run(
      () =>
        addShoppingItemAction({
          name: match?.name ?? name,
          quantity: q,
          unit,
          productId: match?.id ?? null,
          categoryId: match?.category_id ?? null,
        }),
      () => {
        setName("");
        setQuantity("1");
      },
    );
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-3 shadow-card" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="shop-name" className="sr-only">
          Item to buy
        </label>
        <Input
          id="shop-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an item…"
          list="shop-products"
          autoComplete="off"
          className="sm:flex-1"
          autoFocus={autoFocus}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "shop-error" : undefined}
        />
        <datalist id="shop-products">
          {products.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <div className="flex gap-2">
          <label htmlFor="shop-qty" className="sr-only">
            Quantity
          </label>
          <Input id="shop-qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className="w-20" />
          <label htmlFor="shop-unit" className="sr-only">
            Unit
          </label>
          <div className="w-28">
            <UnitSelect id="shop-unit" value={unit} onChange={(e) => setUnit(e.target.value)} compatibleWith={match?.default_unit} />
          </div>
          <Button type="submit" loading={pending} aria-label="Add to list">
            {pending ? null : <Plus />}
            <span className="max-sm:sr-only">Add</span>
          </Button>
        </div>
      </div>
      {error ? (
        <p id="shop-error" role="alert" className="mt-2 px-1 text-[13px] text-critical">
          {error}
        </p>
      ) : match ? (
        <p className="mt-2 px-1 text-[13px] text-muted-foreground">Linked to “{match.name}” in your inventory.</p>
      ) : categories.length === 0 ? null : null}
    </form>
  );
}

function EditItemDialog({ item, categories, onOpenChange }: { item: ViewItem | null; categories: Category[]; onOpenChange: (o: boolean) => void }) {
  const [values, setValues] = React.useState({ name: "", quantity: "", unit: "pcs", categoryId: "", notes: "" });
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const { pending, run } = useAction();
  React.useEffect(() => {
    if (item) {
      setValues({ name: item.name, quantity: String(item.quantity), unit: item.unit, categoryId: item.category_id ?? "", notes: item.notes ?? "" });
      setErrors({});
    }
  }, [item]);
  if (!item) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseQuantityInput(values.quantity);
    if (q === null || q <= 0) return setErrors({ quantity: ["Enter a quantity greater than zero"] });
    run(() => updateShoppingItemAction({ id: item.id, ...values, quantity: q }), () => onOpenChange(false));
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Edit item" size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Item" htmlFor="edit-name" required error={errors.name}>
            <Input {...fieldA11y("edit-name", errors.name)} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} maxLength={120} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" htmlFor="edit-qty" required error={errors.quantity}>
              <Input {...fieldA11y("edit-qty", errors.quantity)} value={values.quantity} onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.value }))} inputMode="decimal" />
            </Field>
            <Field label="Unit" htmlFor="edit-unit" required>
              <UnitSelect id="edit-unit" value={values.unit} onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))} compatibleWith={item.product?.default_unit} />
            </Field>
          </div>
          <Field label="Category" htmlFor="edit-cat">
            <NativeSelect id="edit-cat" value={values.categoryId} onChange={(e) => setValues((v) => ({ ...v, categoryId: e.target.value }))}>
              <option value="">Other</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Note" htmlFor="edit-notes">
            <Input id="edit-notes" value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} maxLength={300} placeholder="e.g. the large pack" />
          </Field>
          <DialogFooter className="mt-1">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({
  open,
  onOpenChange,
  items,
  locations,
  defaultLocations,
  fallbackLocationId,
  currency,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: ViewItem[];
  locations: Array<{ id: string; label: string }>;
  defaultLocations: Record<string, string>;
  fallbackLocationId: string | null;
  currency: string;
}) {
  type Row = { include: boolean; locationId: string; expiryDate: string; price: string };
  const [rows, setRows] = React.useState<Record<string, Row>>({});
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = useAction();

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setRows(
      Object.fromEntries(
        items.map((i) => [
          i.id,
          { include: true, locationId: (i.product_id && defaultLocations[i.product_id]) || fallbackLocationId || "", expiryDate: "", price: "" },
        ]),
      ),
    );
  }, [open, items, defaultLocations, fallbackLocationId]);

  const update = (id: string, change: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id]!, ...change } }));
  const selected = items.filter((i) => rows[i.id]?.include);

  const submit = () => {
    const missing = selected.find((i) => !rows[i.id]?.locationId);
    if (missing) return setError(`Choose where “${missing.name}” will be stored.`);
    if (selected.length === 0) return setError("Select at least one item.");
    setError(null);
    run(
      () =>
        completeShoppingAction({
          items: selected.map((i) => ({
            itemId: i.id,
            locationId: rows[i.id]!.locationId,
            expiryDate: rows[i.id]!.expiryDate,
            price: rows[i.id]!.price,
          })),
        }),
      () => onOpenChange(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add purchases to inventory" description="Checked items become stock in the location you choose. Expiry and price are optional." size="lg">
        {error ? (
          <p role="alert" className="mb-3 rounded-lg bg-critical-soft px-3 py-2.5 text-sm text-critical">
            {error}
          </p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {items.map((i) => {
            const row = rows[i.id];
            if (!row) return null;
            return (
              <li key={i.id} className={cn("rounded-xl border border-border p-3", !row.include && "opacity-60")}>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={row.include} onChange={(e) => update(i.id, { include: e.target.checked })} className="size-[18px] accent-[var(--primary)]" />
                  <span className="flex-1 text-sm font-medium">{i.name}</span>
                  <span className="tabular text-sm text-muted-foreground">{formatQuantity(i.quantity, i.unit)}</span>
                </label>
                {row.include ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                    <div>
                      <label htmlFor={`loc-${i.id}`} className="mb-1 block text-xs text-muted-foreground">
                        Store in
                      </label>
                      <NativeSelect id={`loc-${i.id}`} value={row.locationId} onChange={(e) => update(i.id, { locationId: e.target.value })}>
                        <option value="">Choose…</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div>
                      <label htmlFor={`exp-${i.id}`} className="mb-1 block text-xs text-muted-foreground">
                        Expires
                      </label>
                      <Input id={`exp-${i.id}`} type="date" value={row.expiryDate} onChange={(e) => update(i.id, { expiryDate: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor={`price-${i.id}`} className="mb-1 block text-xs text-muted-foreground">
                        Price ({currency})
                      </label>
                      <Input id={`price-${i.id}`} value={row.price} onChange={(e) => update(i.id, { price: e.target.value })} inputMode="decimal" type="number" min="0" step="0.01" />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending}>
            Add {selected.length} to inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShoppingList({
  items,
  removed,
  categories,
  products,
  locations,
  defaultLocations,
  fallbackLocationId,
  currency,
  canEdit,
  autoFocusAdd,
}: ShoppingListProps) {
  const { enqueue, pendingChecked, online, syncNow, items: queue } = useOffline();
  const { pending, run } = useAction();
  const [editing, setEditing] = React.useState<ViewItem | null>(null);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const view: ViewItem[] = items.map((i) => {
    const queued = pendingChecked(i.id);
    const checked = queued === null ? Boolean(i.checked_at) : queued;
    return {
      ...i,
      checkedAt: checked ? i.checked_at ?? new Date(0).toISOString() : null,
      storeSection: i.category?.store_section ?? null,
      categoryName: i.category?.name ?? null,
      productId: i.product_id,
      pendingToggle: queued !== null && queued !== Boolean(i.checked_at),
    };
  });
  const groups = groupShoppingItems(view);
  const progress = shoppingProgress(view);
  const checked = view.filter((i) => i.checkedAt);
  const hasPendingToggles = queue.some((m) => m.payload.type === "shopping.toggle" && m.status !== "failed");

  const toggle = async (item: ViewItem, value: boolean) => {
    try {
      await enqueue({ type: "shopping.toggle", itemId: item.id, checked: value, label: item.name });
    } catch {
      toast.error("Couldn't save that change on this device.");
    }
  };

  const openComplete = async () => {
    if (!online) {
      toast.error("Adding purchases to inventory needs a connection.");
      return;
    }
    if (hasPendingToggles) await syncNow();
    setCompleteOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {canEdit ? <AddItemForm categories={categories} products={products} autoFocus={autoFocusAdd} /> : null}

      {view.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <span className="tabular text-sm text-muted-foreground" aria-live="polite">
              {progress.done} of {progress.total} in cart
            </span>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => run(() => addLowStockToListAction())} disabled={pending || !online}>
                <PackageMinus /> Add low stock
              </Button>
              {checked.length ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={pending || !online}>
                    Clear checked
                  </Button>
                  <Button size="sm" onClick={() => void openComplete()} disabled={pending}>
                    <ShoppingBag /> Finish shopping
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {view.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your list is empty"
          description="Add items above, pull in everything that's running low, or add missing ingredients from a recipe."
          action={
            canEdit ? (
              <Button variant="secondary" onClick={() => run(() => addLowStockToListAction())} loading={pending}>
                {pending ? null : <ListPlus />} Add low-stock items
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`grp-${group.key}`}>
              <h2 id={`grp-${group.key}`} className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                {group.items.map((item) => {
                  const isChecked = Boolean(item.checkedAt);
                  return (
                    <li key={item.id} className="flex items-center gap-1 pr-2">
                      <label className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 px-4 py-2.5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(v: boolean | "indeterminate") => void toggle(item, v === true)}
                          disabled={!canEdit}
                          aria-label={`${isChecked ? "Uncheck" : "Check off"} ${item.name}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[15px] transition-colors", isChecked && "text-muted-foreground line-through")}>{item.name}</span>
                          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="tabular">{formatQuantity(item.quantity, item.unit)}</span>
                            {item.notes ? <span>· {item.notes}</span> : null}
                            {item.source === "low_stock" ? (
                              <Badge tone="warning" className="py-0">
                                <PackageMinus aria-hidden /> Low stock
                              </Badge>
                            ) : item.source === "recipe" ? (
                              <Badge tone="info" className="py-0">
                                <ChefHat aria-hidden /> Recipe
                              </Badge>
                            ) : null}
                            {item.pendingToggle ? <span className="text-info">· Pending sync</span> : null}
                          </span>
                        </span>
                      </label>
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => setEditing(item)} disabled={!online}>
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => run(() => removeShoppingItemsAction([item.id]))} disabled={!online}>
                              <Trash2 /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {removed.length > 0 && canEdit ? (
        <section aria-labelledby="removed-heading" className="mt-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 id="removed-heading" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recently removed
            </h2>
            <button type="button" onClick={() => run(() => purgeRemovedShoppingItemsAction())} className="text-xs font-medium text-muted-foreground hover:text-foreground" disabled={pending}>
              Clear
            </button>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-dashed border-border-strong">
            {removed.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {item.name} · {formatQuantity(item.quantity, item.unit)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => run(() => restoreShoppingItemAction(item.id))} disabled={pending || !online}>
                  <RotateCcw /> Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EditItemDialog item={editing} categories={categories} onOpenChange={(o) => !o && setEditing(null)} />
      <CompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        items={checked}
        locations={locations}
        defaultLocations={defaultLocations}
        fallbackLocationId={fallbackLocationId}
        currency={currency}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear checked items?"
        description="They'll be removed from the list without being added to inventory. You can restore them from “Recently removed”."
        confirmLabel="Clear checked"
        pending={pending}
        onConfirm={() => run(() => removeShoppingItemsAction(checked.map((c) => c.id)), () => setConfirmClear(false))}
      />
    </div>
  );
}

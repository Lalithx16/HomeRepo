"use client";

import { AlertTriangle, ChevronDown, ImagePlus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { createItemAction, updateProductAction } from "@/lib/actions/inventory";
import type { SavedLocation } from "@/lib/actions/locations";
import { locationPath } from "@/lib/domain/locations";
import { parseQuantityInput } from "@/lib/domain/quantity";
import { normalizeIngredientKey } from "@/lib/domain/recipes";
import { getUnit, unitLabel } from "@/lib/domain/units";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { UnitSelect } from "@/components/shared/unit-select";
import { useOffline } from "@/components/offline/offline-provider";
import { LocationFormDialog, type LocationLite } from "@/components/locations/location-form-dialog";
import { CategoryFormDialog } from "./category-form-dialog";

export interface ItemFormInitial {
  productId?: string;
  version?: number;
  name?: string;
  brand?: string | null;
  categoryId?: string | null;
  unit?: string;
  minQuantity?: number | null;
  targetQuantity?: number | null;
  ingredientKey?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  /** Units that existing batches use (restricts unit changes when editing). */
  lockedToUnit?: string | null;
}

interface ItemFormProps {
  mode: "create" | "edit";
  initial?: ItemFormInitial;
  categories: Category[];
  locations: LocationLite[];
  brands: string[];
  ingredientKeys: string[];
  defaultLocationId?: string | null;
  currency: string;
  today: string;
}

type Errors = Record<string, string[] | undefined>;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

const toStr = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function ItemForm({
  mode,
  initial,
  categories: initialCategories,
  locations: initialLocations,
  brands,
  ingredientKeys,
  defaultLocationId,
  currency,
  today,
}: ItemFormProps) {
  const router = useRouter();
  const { online } = useOffline();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState<{ productId: string; productName: string } | null>(null);

  const [categories, setCategories] = React.useState(initialCategories);
  const [locations, setLocations] = React.useState(initialLocations);
  const [categoryDialog, setCategoryDialog] = React.useState(false);
  const [locationDialog, setLocationDialog] = React.useState(false);

  const [values, setValues] = React.useState({
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    categoryId: initial?.categoryId ?? "",
    unit: initial?.unit ?? "pcs",
    quantity: mode === "create" ? "1" : "",
    locationId: defaultLocationId ?? "",
    expiryDate: "",
    purchaseDate: "",
    price: "",
    minQuantity: toStr(initial?.minQuantity),
    targetQuantity: toStr(initial?.targetQuantity),
    ingredientKey: initial?.ingredientKey ?? "",
    notes: initial?.notes ?? "",
  });
  const [moreOpen, setMoreOpen] = React.useState(Boolean(initial?.notes || initial?.ingredientKey));
  const [image, setImage] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(initial?.imageUrl ?? null);
  const [clearImage, setClearImage] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const set = <K extends keyof typeof values>(key: K) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === "name" || key === "brand") setDuplicate(null);
  };

  const locationOptions = React.useMemo(
    () => locations.map((l) => ({ id: l.id, label: locationPath(locations, l.id, " › ") })).sort((a, b) => a.label.localeCompare(b.label)),
    [locations],
  );
  const unitName = unitLabel(values.unit, 2);
  const suggestedKey = values.name ? normalizeIngredientKey(values.name) : "";

  const validate = (): Errors => {
    const e: Errors = {};
    if (!values.name.trim()) e.name = ["Name is required"];
    if (mode === "create") {
      const q = parseQuantityInput(values.quantity);
      if (q === null) e.quantity = ["Enter a quantity (0 or more)"];
      if (!values.locationId) e.locationId = ["Choose where it's stored"];
      if (values.expiryDate && values.purchaseDate && values.expiryDate < values.purchaseDate) {
        e.expiryDate = ["Expiry can't be before the purchase date"];
      }
      if (values.price && parseQuantityInput(values.price) === null) e.price = ["Enter a valid price"];
    }
    if (values.minQuantity && parseQuantityInput(values.minQuantity) === null) e.minQuantity = ["Enter a number"];
    if (values.targetQuantity) {
      const t = parseQuantityInput(values.targetQuantity);
      const m = parseQuantityInput(values.minQuantity);
      if (t === null) e.targetQuantity = ["Enter a number"];
      else if (m === null) e.minQuantity = ["Set a minimum to use a restock target"];
      else if (t < m) e.targetQuantity = ["Target must be at least the minimum"];
    }
    return e;
  };

  const submit = (opts: { existingProductId?: string } = {}) => {
    setFormError(null);
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      const first = Object.keys(clientErrors)[0];
      document.getElementById(`item-${first}`)?.focus();
      return;
    }
    if (!online) {
      setFormError("You're offline. Your entries are kept here — save again once you're connected.");
      return;
    }
    const fd = new FormData();
    const numeric = (s: string) => {
      const n = parseQuantityInput(s);
      return n === null ? "" : String(n);
    };
    fd.set("name", values.name);
    fd.set("brand", values.brand);
    fd.set("categoryId", values.categoryId);
    fd.set("unit", values.unit);
    fd.set("minQuantity", numeric(values.minQuantity));
    fd.set("targetQuantity", numeric(values.targetQuantity));
    fd.set("ingredientKey", values.ingredientKey.trim() ? normalizeIngredientKey(values.ingredientKey) : "");
    fd.set("notes", values.notes);
    if (image) fd.set("image", image);

    startTransition(async () => {
      let result: ActionResult<{ productId: string }>;
      try {
        if (mode === "create") {
          fd.set("quantity", numeric(values.quantity));
          fd.set("locationId", values.locationId);
          fd.set("expiryDate", values.expiryDate);
          fd.set("purchaseDate", values.purchaseDate);
          fd.set("price", numeric(values.price));
          if (opts.existingProductId) fd.set("existingProductId", opts.existingProductId);
          result = await createItemAction(fd);
        } else {
          fd.set("productId", initial?.productId ?? "");
          fd.set("version", String(initial?.version ?? 1));
          if (clearImage) fd.set("clearImage", "true");
          result = await updateProductAction(fd);
        }
      } catch {
        // Network or server failure: keep everything the user typed.
        setFormError("Couldn't reach Homebase. Your entries are kept — try again.");
        return;
      }
      if (!result.ok) {
        if (result.code === "duplicate" && result.meta?.productId) {
          setDuplicate({ productId: result.meta.productId, productName: result.meta.productName ?? values.name });
          return;
        }
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      router.push(`/inventory/${result.data.productId}`);
      router.refresh();
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onCategorySaved = (c: Category) => {
    setCategories((list) => [...list.filter((x) => x.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name)));
    setValues((v) => ({ ...v, categoryId: c.id }));
  };
  const onLocationSaved = (l: SavedLocation) => {
    setLocations((list) => [...list.filter((x) => x.id !== l.id), { id: l.id, parentId: l.parent_id, name: l.name, kind: l.kind }]);
    setValues((v) => ({ ...v, locationId: l.id }));
    setErrors((e) => ({ ...e, locationId: undefined }));
  };

  const unitDim = (() => {
    try {
      return getUnit(values.unit).dimension;
    } catch {
      return "count";
    }
  })();
  const quantityStep = unitDim === "count" || unitDim === "package" ? "1" : "any";

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex max-w-3xl flex-col gap-4">
      {formError ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-critical-soft px-4 py-3 text-sm text-critical">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formError}
        </div>
      ) : null}

      {duplicate ? (
        <div role="alert" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <p className="font-medium text-warning">You already track “{duplicate.productName}”.</p>
          <p className="mt-1 text-muted-foreground">
            Add this as a new batch of the existing item (keeps one item with separate quantities and expiry dates), or change the name or brand.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => submit({ existingProductId: duplicate.productId })} loading={pending}>
              Add as new batch
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/inventory/${duplicate.productId}`}>View existing item</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Section title="Item" description="What is it?">
        <Field label="Name" htmlFor="item-name" required error={errors.name}>
          <Input {...fieldA11y("item-name", errors.name)} value={values.name} onChange={set("name")} placeholder="e.g. Basmati rice" maxLength={120} autoFocus={mode === "create"} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" htmlFor="item-brand" error={errors.brand}>
            <Input {...fieldA11y("item-brand", errors.brand)} value={values.brand ?? ""} onChange={set("brand")} list="brand-options" maxLength={80} autoComplete="off" />
            <datalist id="brand-options">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Category"
            htmlFor="item-categoryId"
            error={errors.categoryId}
            action={
              <button type="button" onClick={() => setCategoryDialog(true)} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                <Plus className="size-3.5" aria-hidden /> New
              </button>
            }
          >
            <NativeSelect {...fieldA11y("item-categoryId", errors.categoryId)} value={values.categoryId ?? ""} onChange={set("categoryId")}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section title={mode === "create" ? "Stock" : "Unit"} description={mode === "create" ? "How much do you have, and where is it?" : "Batches keep their own units; they must be convertible to this one."}>
        <div className="grid grid-cols-[1fr_1fr] gap-4 sm:grid-cols-[1fr_1fr_2fr]">
          {mode === "create" ? (
            <Field label="Quantity" htmlFor="item-quantity" required error={errors.quantity}>
              <Input {...fieldA11y("item-quantity", errors.quantity)} value={values.quantity} onChange={set("quantity")} inputMode="decimal" type="number" min="0" step={quantityStep} />
            </Field>
          ) : null}
          <Field label="Unit" htmlFor="item-unit" required error={errors.unit} className={mode === "edit" ? "col-span-2 sm:col-span-1" : undefined}>
            <UnitSelect {...fieldA11y("item-unit", errors.unit)} value={values.unit} onChange={set("unit")} compatibleWith={initial?.lockedToUnit ?? undefined} />
          </Field>
          {mode === "create" ? (
            <Field
              label="Storage location"
              htmlFor="item-locationId"
              required
              error={errors.locationId}
              className="col-span-2 sm:col-span-1"
              action={
                <button type="button" onClick={() => setLocationDialog(true)} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                  <Plus className="size-3.5" aria-hidden /> New
                </button>
              }
            >
              <NativeSelect {...fieldA11y("item-locationId", errors.locationId)} value={values.locationId} onChange={set("locationId")}>
                <option value="">Choose a location…</option>
                {locationOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
        </div>
        {mode === "create" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expiry date" htmlFor="item-expiryDate" error={errors.expiryDate} hint="Leave empty for things that don't expire.">
              <Input {...fieldA11y("item-expiryDate", errors.expiryDate, true)} type="date" value={values.expiryDate} onChange={set("expiryDate")} min={values.purchaseDate || undefined} />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Restock rule" description={`Get a low-stock alert and a shopping suggestion when you drop below the minimum (in ${unitName}).`}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum to keep" htmlFor="item-minQuantity" error={errors.minQuantity}>
            <Input {...fieldA11y("item-minQuantity", errors.minQuantity)} value={values.minQuantity} onChange={set("minQuantity")} inputMode="decimal" type="number" min="0" step="any" placeholder="No alert" />
          </Field>
          <Field label="Restock up to" htmlFor="item-targetQuantity" error={errors.targetQuantity} hint="Defaults to the household rule.">
            <Input {...fieldA11y("item-targetQuantity", errors.targetQuantity, true)} value={values.targetQuantity} onChange={set("targetQuantity")} inputMode="decimal" type="number" min="0" step="any" />
          </Field>
        </div>
      </Section>

      <Card className="p-0">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="flex w-full items-center justify-between px-4 py-4 text-left sm:px-6"
        >
          <span>
            <span className="block text-[15px] font-semibold tracking-tight">More details</span>
            <span className="block text-[13px] text-muted-foreground">
              {mode === "create" ? "Purchase info, recipe matching, notes and a photo" : "Recipe matching, notes and photo"}
            </span>
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", moreOpen && "rotate-180")} aria-hidden />
        </button>
        {moreOpen ? (
          <div className="flex flex-col gap-4 border-t border-border px-4 py-5 sm:px-6">
            {mode === "create" ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Purchase date" htmlFor="item-purchaseDate" error={errors.purchaseDate}>
                  <Input {...fieldA11y("item-purchaseDate", errors.purchaseDate)} type="date" value={values.purchaseDate} onChange={set("purchaseDate")} max={today} />
                </Field>
                <Field label={`Price paid (${currency})`} htmlFor="item-price" error={errors.price}>
                  <Input {...fieldA11y("item-price", errors.price)} value={values.price} onChange={set("price")} inputMode="decimal" type="number" min="0" step="0.01" />
                </Field>
              </div>
            ) : null}
            <Field
              label="Recipe ingredient"
              htmlFor="item-ingredientKey"
              error={errors.ingredientKey}
              hint={
                suggestedKey
                  ? `Recipes match by name automatically (e.g. “${suggestedKey}”). Set this if the name is different, like “Atta” → “wheat flour”.`
                  : "Helps match this item to recipe ingredients."
              }
            >
              <Input {...fieldA11y("item-ingredientKey", errors.ingredientKey, true)} value={values.ingredientKey ?? ""} onChange={set("ingredientKey")} list="ingredient-options" maxLength={40} autoComplete="off" />
              <datalist id="ingredient-options">
                {ingredientKeys.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>
            <Field label="Notes" htmlFor="item-notes" error={errors.notes}>
              <Textarea {...fieldA11y("item-notes", errors.notes)} value={values.notes ?? ""} onChange={set("notes")} maxLength={2000} />
            </Field>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium">
                Photo <span className="font-normal text-muted-foreground">Optional · JPEG, PNG or WebP up to 5 MB</span>
              </span>
              <div className="flex items-center gap-3">
                {preview && !clearImage ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Selected item" className="size-20 rounded-xl border border-border object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImage(null);
                        setPreview(null);
                        if (fileRef.current) fileRef.current.value = "";
                        if (mode === "edit" && initial?.imageUrl) setClearImage(true);
                      }}
                      className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border border-border bg-surface shadow-card"
                      aria-label="Remove photo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : null}
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> {preview && !clearImage ? "Replace photo" : "Add photo"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  aria-label="Choose photo"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > 5 * 1024 * 1024) {
                      setErrors((er) => ({ ...er, image: ["Photos must be 5 MB or smaller"] }));
                      e.target.value = "";
                      return;
                    }
                    setErrors((er) => ({ ...er, image: undefined }));
                    setClearImage(false);
                    setImage(file);
                  }}
                />
              </div>
              {errors.image ? (
                <p className="mt-1.5 text-[13px] text-critical" role="alert">
                  {errors.image[0]}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none md:bottom-0">
        <Button variant="secondary" onClick={() => router.back()} className="flex-1 sm:flex-none">
          Cancel
        </Button>
        <Button type="submit" loading={pending} className="flex-1 sm:flex-none">
          {mode === "create" ? "Save item" : "Save changes"}
        </Button>
      </div>

      <CategoryFormDialog open={categoryDialog} onOpenChange={setCategoryDialog} onSaved={onCategorySaved} />
      <LocationFormDialog open={locationDialog} onOpenChange={setLocationDialog} locations={locations} onSaved={onLocationSaved} />
    </form>
  );
}

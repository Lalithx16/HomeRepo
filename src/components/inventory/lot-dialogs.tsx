"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { addStockAction, moveLotAction, setLotQuantityAction, updateLotAction } from "@/lib/actions/inventory";
import { parseQuantityInput } from "@/lib/domain/quantity";
import { compatibleUnits, formatQuantity } from "@/lib/domain/units";
import type { LotDetailRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

type Errors = Record<string, string[] | undefined>;
export type LocationOption = { id: string; label: string };

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, onDone: () => void) => {
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.fieldErrors ? null : result.error);
          return;
        }
        toast.success(result.message ?? "Saved");
        onDone();
        router.refresh();
      } catch {
        setFormError("Couldn't reach Homebase. Check your connection and try again.");
      }
    });
  };
  return { pending, errors, setErrors, formError, run };
}

function FormAlert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="mb-4 rounded-lg bg-critical-soft px-3 py-2.5 text-sm text-critical">
      {message}
    </p>
  ) : null;
}

interface DialogBase {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Correct an incorrect count (absolute value, recorded as an adjustment). */
export function AdjustCountDialog({ open, onOpenChange, lot }: DialogBase & { lot: LotDetailRow }) {
  const [value, setValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const { pending, errors, setErrors, formError, run } = useSubmit();
  React.useEffect(() => {
    if (open) {
      setValue(String(lot.quantity));
      setNote("");
    }
  }, [open, lot.quantity]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseQuantityInput(value);
    if (quantity === null) {
      setErrors({ quantity: ["Enter 0 or more"] });
      return;
    }
    run(() => setLotQuantityAction({ lotId: lot.id, quantity, version: lot.version, note }), () => onOpenChange(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Correct the count" description={`Currently recorded: ${formatQuantity(lot.quantity, lot.unit)} in ${lot.location_name}.`} size="sm">
        <form onSubmit={submit} noValidate>
          <FormAlert message={formError} />
          <div className="flex flex-col gap-4">
            <Field label={`Actual amount (${lot.unit})`} htmlFor="adj-qty" required error={errors.quantity}>
              <Input {...fieldA11y("adj-qty", errors.quantity)} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" type="number" min="0" step="any" autoFocus />
            </Field>
            <Field label="Reason" htmlFor="adj-note" error={errors.note}>
              <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Recounted the shelf" maxLength={500} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save count
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveLotDialog({ open, onOpenChange, lot, locations }: DialogBase & { lot: LotDetailRow; locations: LocationOption[] }) {
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [partial, setPartial] = React.useState(false);
  const { pending, errors, setErrors, formError, run } = useSubmit();
  React.useEffect(() => {
    if (open) {
      setTo("");
      setAmount("");
      setPartial(false);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to) {
      setErrors({ toLocationId: ["Choose a destination"] });
      return;
    }
    let quantity: number | null = null;
    if (partial) {
      quantity = parseQuantityInput(amount);
      if (quantity === null || quantity <= 0 || quantity > lot.quantity) {
        setErrors({ quantity: [`Enter an amount up to ${formatQuantity(lot.quantity, lot.unit)}`] });
        return;
      }
    }
    run(() => moveLotAction({ lotId: lot.id, toLocationId: to, quantity }), () => onOpenChange(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Move to another location" description={`From ${lot.location_name}`} size="sm">
        <form onSubmit={submit} noValidate>
          <FormAlert message={formError} />
          <div className="flex flex-col gap-4">
            <Field label="Move to" htmlFor="move-to" required error={errors.toLocationId}>
              <NativeSelect {...fieldA11y("move-to", errors.toLocationId)} value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Choose a location…</option>
                {locations
                  .filter((l) => l.id !== lot.location_id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            {lot.quantity > 0 ? (
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="size-[18px] accent-[var(--primary)]" />
                Move only part of it
              </label>
            ) : null}
            {partial ? (
              <Field label={`Amount to move (${lot.unit})`} htmlFor="move-qty" required error={errors.quantity}>
                <Input {...fieldA11y("move-qty", errors.quantity)} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" type="number" min="0" step="any" />
              </Field>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditLotDialog({ open, onOpenChange, lot }: DialogBase & { lot: LotDetailRow }) {
  const [expiry, setExpiry] = React.useState("");
  const [purchase, setPurchase] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const { pending, errors, formError, run } = useSubmit();
  React.useEffect(() => {
    if (open) {
      setExpiry(lot.expiry_date ?? "");
      setPurchase(lot.purchase_date ?? "");
      setNotes(lot.notes ?? "");
    }
  }, [open, lot]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => updateLotAction({ lotId: lot.id, version: lot.version, expiryDate: expiry, purchaseDate: purchase, notes }),
      () => onOpenChange(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit batch" size="sm">
        <form onSubmit={submit} noValidate>
          <FormAlert message={formError} />
          <div className="flex flex-col gap-4">
            <Field label="Expiry date" htmlFor="lot-expiry" error={errors.expiryDate} hint="Clear it if this batch doesn't expire.">
              <Input {...fieldA11y("lot-expiry", errors.expiryDate, true)} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
            <Field label="Purchase date" htmlFor="lot-purchase" error={errors.purchaseDate}>
              <Input {...fieldA11y("lot-purchase", errors.purchaseDate)} type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="lot-notes" error={errors.notes}>
              <Textarea id="lot-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
            </Field>
          </div>
          <DialogFooter>
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

export function AddStockDialog({
  open,
  onOpenChange,
  product,
  locations,
  defaultLocationId,
  currency,
}: DialogBase & {
  product: { id: string; name: string; default_unit: string };
  locations: LocationOption[];
  defaultLocationId: string | null;
  currency: string;
}) {
  const [values, setValues] = React.useState({ quantity: "", unit: product.default_unit, locationId: "", expiryDate: "", purchaseDate: "", price: "" });
  const { pending, errors, setErrors, formError, run } = useSubmit();
  React.useEffect(() => {
    if (open) setValues({ quantity: "", unit: product.default_unit, locationId: defaultLocationId ?? "", expiryDate: "", purchaseDate: "", price: "" });
  }, [open, product.default_unit, defaultLocationId]);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseQuantityInput(values.quantity);
    const errs: Errors = {};
    if (quantity === null || quantity <= 0) errs.quantity = ["Enter an amount greater than zero"];
    if (!values.locationId) errs.locationId = ["Choose a location"];
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    run(
      () =>
        addStockAction({
          productId: product.id,
          locationId: values.locationId,
          quantity,
          unit: values.unit,
          expiryDate: values.expiryDate,
          purchaseDate: values.purchaseDate,
          price: values.price,
        }),
      () => onOpenChange(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Add ${product.name}`} description="Same location and expiry date merge into one batch.">
        <form onSubmit={submit} noValidate>
          <FormAlert message={formError} />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" htmlFor="add-qty" required error={errors.quantity}>
                <Input {...fieldA11y("add-qty", errors.quantity)} value={values.quantity} onChange={set("quantity")} inputMode="decimal" type="number" min="0" step="any" autoFocus />
              </Field>
              <Field label="Unit" htmlFor="add-unit" required>
                <NativeSelect id="add-unit" value={values.unit} onChange={set("unit")}>
                  {compatibleUnits(product.default_unit).map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.pluralLabel}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Location" htmlFor="add-loc" required error={errors.locationId}>
              <NativeSelect {...fieldA11y("add-loc", errors.locationId)} value={values.locationId} onChange={set("locationId")}>
                <option value="">Choose a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Expiry date" htmlFor="add-exp" error={errors.expiryDate}>
              <Input {...fieldA11y("add-exp", errors.expiryDate)} type="date" value={values.expiryDate} onChange={set("expiryDate")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchase date" htmlFor="add-pd" error={errors.purchaseDate}>
                <Input {...fieldA11y("add-pd", errors.purchaseDate)} type="date" value={values.purchaseDate} onChange={set("purchaseDate")} />
              </Field>
              <Field label={`Price (${currency})`} htmlFor="add-price" error={errors.price}>
                <Input {...fieldA11y("add-price", errors.price)} value={values.price} onChange={set("price")} inputMode="decimal" type="number" min="0" step="0.01" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

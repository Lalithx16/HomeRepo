"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { updateHouseholdAction } from "@/lib/actions/household";
import type { Household } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { CURRENCIES } from "@/components/onboarding/create-household-form";

export function HouseholdSettingsForm({ household, canEdit }: { household: Household; canEdit: boolean }) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    name: household.name,
    timezone: household.timezone,
    currency: household.currency,
    expiryWarningDays: String(household.expiry_warning_days),
    restockMultiplier: String(household.restock_multiplier),
  });
  const [zones, setZones] = React.useState<string[]>([household.timezone]);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (supported?.length) setZones(Array.from(new Set(["UTC", household.timezone, ...supported])));
  }, [household.timezone]);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateHouseholdAction(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      toast.success(result.message);
      router.refresh();
    });
  };

  const currencies = CURRENCIES.includes(values.currency) ? CURRENCIES : [values.currency, ...CURRENCIES];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={!canEdit || pending} className="flex flex-col gap-4">
        <Field label="Household name" htmlFor="hh-name" required error={errors.name}>
          <Input {...fieldA11y("hh-name", errors.name)} value={values.name} onChange={set("name")} maxLength={80} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Time zone" htmlFor="hh-tz" required error={errors.timezone} hint="Decides what “today” means for expiry dates.">
            <NativeSelect {...fieldA11y("hh-tz", errors.timezone, true)} value={values.timezone} onChange={set("timezone")}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Currency" htmlFor="hh-cur" required error={errors.currency}>
            <NativeSelect {...fieldA11y("hh-cur", errors.currency)} value={values.currency} onChange={set("currency")}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="“Expiring soon” window (days)" htmlFor="hh-days" required error={errors.expiryWarningDays}>
            <Input {...fieldA11y("hh-days", errors.expiryWarningDays)} value={values.expiryWarningDays} onChange={set("expiryWarningDays")} type="number" min="0" max="90" inputMode="numeric" />
          </Field>
          <Field
            label="Restock multiplier"
            htmlFor="hh-mult"
            required
            error={errors.restockMultiplier}
            hint="Without a target, suggestions refill to minimum × this number."
          >
            <Input {...fieldA11y("hh-mult", errors.restockMultiplier, true)} value={values.restockMultiplier} onChange={set("restockMultiplier")} type="number" min="1" max="10" step="0.5" inputMode="decimal" />
          </Field>
        </div>
      </fieldset>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save settings
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only owners can change household settings.</p>
      )}
    </form>
  );
}

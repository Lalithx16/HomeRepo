"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { createHouseholdAction } from "@/lib/actions/household";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "AED", "CHF", "NZD", "ZAR", "BRL", "MXN", "SEK", "NOK", "DKK"];

function guessCurrency(tz: string): string {
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "INR";
  if (tz === "Europe/London") return "GBP";
  if (tz.startsWith("Europe/")) return "EUR";
  if (tz.startsWith("Australia/")) return "AUD";
  if (tz === "Asia/Tokyo") return "JPY";
  if (tz === "Asia/Singapore") return "SGD";
  if (tz === "Asia/Dubai") return "AED";
  return "USD";
}

export function CreateHouseholdForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [timezone, setTimezone] = React.useState("UTC");
  const [currency, setCurrency] = React.useState("USD");
  const [zones, setZones] = React.useState<string[]>(["UTC"]);

  React.useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setTimezone(tz);
    setCurrency(guessCurrency(tz));
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    setZones(supported && supported.length ? Array.from(new Set(["UTC", tz, ...supported])) : ["UTC", tz]);
  }, []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      timezone,
      currency,
      seedDefaults: fd.get("seedDefaults") === "on",
    };
    setErrors({});
    startTransition(async () => {
      const result = await createHouseholdAction(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Household created");
      router.push("/");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Household name" htmlFor="name" required error={errors.name}>
        <Input {...fieldA11y("name", errors.name)} name="name" placeholder="e.g. Our Home" autoComplete="off" required maxLength={80} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone" htmlFor="timezone" required error={errors.timezone} hint="Used for expiry dates.">
          <NativeSelect {...fieldA11y("timezone", errors.timezone, true)} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Currency" htmlFor="currency" required error={errors.currency}>
          <NativeSelect {...fieldA11y("currency", errors.currency)} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5">
        <input type="checkbox" name="seedDefaults" defaultChecked className="mt-0.5 size-[18px] accent-[var(--primary)]" />
        <span className="text-sm">
          <span className="font-medium">Start with a kitchen setup</span>
          <span className="mt-0.5 block text-muted-foreground">
            Adds common categories and locations: Kitchen, Pantry (with shelves), Refrigerator, Freezer, Cabinets and Spice drawer. You can change them anytime.
          </span>
        </span>
      </label>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Create household
      </Button>
    </form>
  );
}

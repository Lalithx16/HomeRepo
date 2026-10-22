import * as React from "react";
import { compatibleUnits, UNIT_GROUPS, UNITS } from "@/lib/domain/units";
import { NativeSelect } from "@/components/ui/input";

/** Grouped unit picker. Pass `compatibleWith` to only offer convertible units. */
export const UnitSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { compatibleWith?: string }
>(function UnitSelect({ compatibleWith, ...props }, ref) {
  const allowed = compatibleWith ? new Set(compatibleUnits(compatibleWith).map((u) => u.code)) : null;
  return (
    <NativeSelect ref={ref} {...props}>
      {UNIT_GROUPS.map((group) => {
        const units = UNITS.filter((u) => u.dimension === group.dimension && (!allowed || allowed.has(u.code)));
        if (units.length === 0) return null;
        return (
          <optgroup key={group.dimension} label={group.label}>
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.pluralLabel}
              </option>
            ))}
          </optgroup>
        );
      })}
    </NativeSelect>
  );
});

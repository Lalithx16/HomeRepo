import { formatNumber, humanizeQuantity, unitLabel } from "@/lib/domain/units";
import { cn } from "@/lib/utils";

export function QuantityText({
  quantity,
  unit,
  className,
  humanize = true,
}: {
  quantity: number;
  unit: string;
  className?: string;
  humanize?: boolean;
}) {
  const shown = humanize ? humanizeQuantity(quantity, unit) : { quantity, unit };
  return (
    <span className={cn("tabular", className)}>
      {formatNumber(shown.quantity)} <span className="text-muted-foreground">{unitLabel(shown.unit, shown.quantity)}</span>
    </span>
  );
}

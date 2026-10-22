import { formatQuantity } from "./units";

export type TransactionKind = "create" | "add" | "purchase" | "consume" | "discard" | "adjust" | "move";

export const TRANSACTION_LABEL: Record<TransactionKind, string> = {
  create: "Added to inventory",
  add: "Restocked",
  purchase: "Bought",
  consume: "Used",
  discard: "Discarded",
  adjust: "Count corrected",
  move: "Moved",
};

/** Human-readable summary of an inventory transaction. */
export function describeTransaction(
  t: { kind: TransactionKind; quantity_delta: number; unit: string; to_location_id: string | null; from_location_id: string | null },
  locationName: (id: string | null) => string | null = () => null,
): string {
  const amount = formatQuantity(Math.abs(t.quantity_delta), t.unit);
  switch (t.kind) {
    case "create":
      return `Added ${amount}`;
    case "add":
      return `Added ${amount}`;
    case "purchase":
      return `Bought ${amount}`;
    case "consume":
      return `Used ${amount}`;
    case "discard":
      return `Discarded ${amount}`;
    case "adjust":
      return `Count ${t.quantity_delta >= 0 ? "increased" : "decreased"} by ${amount}`;
    case "move": {
      const to = locationName(t.to_location_id);
      return to ? `Moved ${amount} to ${to}` : `Moved ${amount}`;
    }
  }
}

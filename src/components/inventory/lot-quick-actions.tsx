"use client";

import { Check, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useOffline } from "@/components/offline/offline-provider";
import { projectQuantity } from "@/lib/domain/quantity";
import { formatQuantity } from "@/lib/domain/units";

/** "Used it all" / "Discard" for a batch — queued, so it works offline too. */
export function LotQuickActions({
  lot,
}: {
  lot: { id: string; product_id: string; product_name: string; quantity: number; unit: string };
}) {
  const { enqueue, pendingDeltas } = useOffline();
  const [confirm, setConfirm] = React.useState(false);
  const remaining = projectQuantity(lot.quantity, pendingDeltas(lot.id));
  if (remaining <= 0) return <span className="text-xs text-muted-foreground">All used</span>;

  const finish = async (kind: "consume" | "discard") => {
    try {
      await enqueue({ type: "lot.adjust", lotId: lot.id, productId: lot.product_id, delta: -remaining, kind, unit: lot.unit, label: lot.product_name });
      toast.success(kind === "consume" ? `Marked ${lot.product_name} as used` : `Discarded ${lot.product_name}`);
    } catch {
      toast.error("Couldn't save that change on this device.");
    }
    setConfirm(false);
  };

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="secondary" onClick={() => void finish("consume")}>
        <Check /> Used it
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} aria-label={`Discard ${lot.product_name}`}>
        <Trash2 />
        <span className="max-sm:sr-only">Discard</span>
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Discard ${lot.product_name}?`}
        description={`${formatQuantity(remaining, lot.unit)} will be recorded as thrown away.`}
        confirmLabel="Discard"
        destructive
        onConfirm={() => void finish("discard")}
      />
    </div>
  );
}

"use client";

import { AlertTriangle, Minus, Plus, RefreshCw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { projectQuantity } from "@/lib/domain/quantity";
import { defaultStep, formatNumber, roundQuantity, unitLabel } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import { useOffline } from "./offline-provider";

interface QuantityStepperProps {
  lotId: string;
  productId: string;
  label: string;
  quantity: number;
  unit: string;
  canEdit: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Quick +/- control for a single batch. Changes go through the durable offline
 * queue (and sync immediately when online), so they're never silently lost.
 */
export function QuantityStepper({ lotId, productId, label, quantity, unit, canEdit, size = "md", className }: QuantityStepperProps) {
  const { enqueue, pendingDeltas, hasFailedForLot } = useOffline();
  const deltas = pendingDeltas(lotId);
  const shown = projectQuantity(quantity, deltas);
  const step = defaultStep(unit);
  const failed = hasFailedForLot(lotId);
  const pending = deltas.length > 0;

  const change = async (direction: 1 | -1) => {
    const delta = direction === 1 ? step : -Math.min(step, shown);
    if (delta === 0) return;
    try {
      await enqueue({
        type: "lot.adjust",
        lotId,
        productId,
        delta: roundQuantity(delta),
        kind: direction === 1 ? "add" : "consume",
        unit,
        label,
      });
    } catch {
      toast.error("Couldn't save that change on this device.");
    }
  };

  const btn = cn(
    "inline-flex items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted disabled:opacity-40 active:scale-95",
    size === "sm" ? "size-10 sm:size-8" : "size-11 sm:size-9",
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {canEdit ? (
        <button type="button" className={btn} onClick={() => void change(-1)} disabled={shown <= 0} aria-label={`Use ${formatNumber(Math.min(step, shown))} ${unitLabel(unit, step)} of ${label}`}>
          <Minus className="size-4" aria-hidden />
        </button>
      ) : null}
      <div className="min-w-[4.5rem] text-center" aria-live="polite">
        <div className={cn("tabular font-semibold", size === "sm" ? "text-sm" : "text-[15px]")}>
          {formatNumber(shown)} <span className="font-normal text-muted-foreground">{unitLabel(unit, shown)}</span>
        </div>
        {failed ? (
          <div className="flex items-center justify-center gap-1 text-[11px] text-critical">
            <AlertTriangle className="size-3" aria-hidden /> Sync failed
          </div>
        ) : pending ? (
          <div className="flex items-center justify-center gap-1 text-[11px] text-info">
            <RefreshCw className="size-3" aria-hidden /> Pending sync
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <button type="button" className={btn} onClick={() => void change(1)} aria-label={`Add ${formatNumber(step)} ${unitLabel(unit, step)} of ${label}`}>
          <Plus className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

"use client";

import { ArrowRightLeft, CalendarDays, MapPin, MoreHorizontal, PencilLine, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { removeLotAction } from "@/lib/actions/inventory";
import { formatDate } from "@/lib/domain/expiry";
import { formatQuantity } from "@/lib/domain/units";
import type { LotDetailRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpiryBadge } from "@/components/shared/status";
import { QuantityStepper } from "@/components/offline/quantity-stepper";
import { AdjustCountDialog, EditLotDialog, MoveLotDialog, type LocationOption } from "./lot-dialogs";

type DialogKind = "adjust" | "move" | "edit" | "remove" | null;

function LotItem({ lot, today, canEdit, locations, paths }: { lot: LotDetailRow; today: string; canEdit: boolean; locations: LocationOption[]; paths: Record<string, string> }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [pending, startTransition] = React.useTransition();
  const close = (open: boolean) => !open && setDialog(null);

  const remove = () =>
    startTransition(async () => {
      const result = await removeLotAction(lot.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDialog(null);
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1">
        <Link href={`/locations/${lot.location_id}`} className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium hover:underline">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{paths[lot.location_id] ?? lot.location_name}</span>
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {lot.expiry_status === "expired" || lot.expiry_status === "expiring" ? (
            <ExpiryBadge status={lot.expiry_status} date={lot.expiry_date} today={today} />
          ) : (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {lot.expiry_date ? `Expires ${formatDate(lot.expiry_date)}` : "No expiry date"}
            </span>
          )}
          {lot.purchase_date ? <span>Bought {formatDate(lot.purchase_date)}</span> : null}
          {lot.quantity === 0 ? <span className="text-critical">Empty</span> : null}
        </div>
        {lot.notes ? <p className="mt-1.5 text-xs text-muted-foreground">{lot.notes}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <QuantityStepper lotId={lot.id} productId={lot.product_id} label={lot.product_name} quantity={lot.quantity} unit={lot.unit} canEdit={canEdit} />
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Batch actions" disabled={pending}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setDialog("adjust")}>
                <Wrench /> Correct count
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("move")}>
                <ArrowRightLeft /> Move
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("edit")}>
                <PencilLine /> Edit dates & notes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDialog("remove")}>
                <Trash2 /> Remove batch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <AdjustCountDialog open={dialog === "adjust"} onOpenChange={close} lot={lot} />
      <MoveLotDialog open={dialog === "move"} onOpenChange={close} lot={lot} locations={locations} />
      <EditLotDialog open={dialog === "edit"} onOpenChange={close} lot={lot} />
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={close}
        title="Remove this batch?"
        description={`${formatQuantity(lot.quantity, lot.unit)} in ${lot.location_name} will be recorded as discarded and removed.`}
        confirmLabel="Remove batch"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </li>
  );
}

export function LotList({
  lots,
  today,
  canEdit,
  locations,
}: {
  lots: LotDetailRow[];
  today: string;
  canEdit: boolean;
  locations: LocationOption[];
}) {
  const paths = Object.fromEntries(locations.map((l) => [l.id, l.label]));
  if (lots.length === 0) {
    return <p className="px-5 py-6 text-sm text-muted-foreground">No batches yet. Add stock to start tracking quantities.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {lots.map((lot) => (
        <LotItem key={lot.id} lot={lot} today={today} canEdit={canEdit} locations={locations} paths={paths} />
      ))}
    </ul>
  );
}

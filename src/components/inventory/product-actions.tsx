"use client";

import { Eye, Minus, MoreHorizontal, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { addProductToShoppingAction, consumeProductAction, deleteProductAction } from "@/lib/actions/inventory";
import { compatibleUnits, formatQuantity } from "@/lib/domain/units";
import { parseQuantityInput } from "@/lib/domain/quantity";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";

interface ProductActionsProps {
  product: { id: string; name: string; total_quantity: number; default_unit: string };
  canEdit: boolean;
  showView?: boolean;
}

export function ProductActions({ product, canEdit, showView = true }: ProductActionsProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [consumeOpen, setConsumeOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const addToList = () =>
    startTransition(async () => {
      const result = await addProductToShoppingAction(product.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmDelete(false);
      toast.success(result.message);
      router.push("/inventory");
      router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${product.name}`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/inventory/${product.id}`}>
                <Eye /> View details
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <>
              <DropdownMenuItem onSelect={() => setConsumeOpen(true)} disabled={product.total_quantity <= 0}>
                <Minus /> Use some…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={addToList}>
                <ShoppingCart /> Add to shopping list
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/inventory/${product.id}/edit`}>
                  <Pencil /> Edit details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete item
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${product.name}?`}
        description="This removes the item and all of its batches. Its history stays in your activity log. This can't be undone."
        confirmLabel="Delete item"
        destructive
        pending={pending}
        onConfirm={remove}
      />
      <ConsumeDialog open={consumeOpen} onOpenChange={setConsumeOpen} product={product} />
    </>
  );
}

/** Use an exact amount of a product, taking from the soonest-expiring batch first. */
export function ConsumeDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; total_quantity: number; default_unit: string };
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [unit, setUnit] = React.useState(product.default_unit);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setUnit(product.default_unit);
      setError(null);
    }
  }, [open, product.default_unit]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = parseQuantityInput(amount);
    if (quantity === null || quantity <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    startTransition(async () => {
      const result = await consumeProductAction({ productId: product.id, quantity, unit });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Use ${product.name}`}
        description={`You have ${formatQuantity(product.total_quantity, product.default_unit)}. We'll use the batch that expires first.`}
        size="sm"
      >
        <form onSubmit={submit} noValidate>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Amount" htmlFor="consume-amount" required error={error ?? undefined}>
              <Input
                {...fieldA11y("consume-amount", error ?? undefined)}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                placeholder="e.g. 250"
              />
            </Field>
            <Field label="Unit" htmlFor="consume-unit" required>
              <NativeSelect id="consume-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {compatibleUnits(product.default_unit).map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.pluralLabel}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Use amount
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

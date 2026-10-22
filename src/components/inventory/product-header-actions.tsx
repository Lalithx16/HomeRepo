"use client";

import { Minus, Pencil, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { addProductToShoppingAction } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { AddStockDialog, type LocationOption } from "./lot-dialogs";
import { ConsumeDialog, ProductActions } from "./product-actions";

export function ProductHeaderActions({
  product,
  locations,
  defaultLocationId,
  currency,
  canEdit,
}: {
  product: { id: string; name: string; default_unit: string; total_quantity: number };
  locations: LocationOption[];
  defaultLocationId: string | null;
  currency: string;
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [useOpen, setUseOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  if (!canEdit) return null;

  const addToList = () =>
    startTransition(async () => {
      const result = await addProductToShoppingAction(product.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Add stock
        </Button>
        <Button variant="secondary" onClick={() => setUseOpen(true)} disabled={product.total_quantity <= 0}>
          <Minus /> Use
        </Button>
        <Button variant="secondary" onClick={addToList} loading={pending}>
          {pending ? null : <ShoppingCart />} <span className="max-sm:sr-only">Add to list</span>
        </Button>
        <Button variant="secondary" size="icon" asChild>
          <Link href={`/inventory/${product.id}/edit`} aria-label="Edit details">
            <Pencil />
          </Link>
        </Button>
        <ProductActions product={product} canEdit={canEdit} showView={false} />
      </div>
      <AddStockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        product={product}
        locations={locations}
        defaultLocationId={defaultLocationId}
        currency={currency}
      />
      <ConsumeDialog open={useOpen} onOpenChange={setUseOpen} product={product} />
    </>
  );
}

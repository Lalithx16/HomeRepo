"use client";

import { Check, ListPlus, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { addProductToShoppingAction } from "@/lib/actions/inventory";
import { addLowStockToListAction } from "@/lib/actions/shopping";
import { Button } from "@/components/ui/button";

export function AddToListButton({ productId, quantity, onList }: { productId: string; quantity?: number; onList: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (onList) {
    return (
      <span className="inline-flex h-10 items-center gap-1 px-2 text-xs font-medium text-success sm:h-8">
        <Check className="size-3.5" aria-hidden /> On list
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await addProductToShoppingAction(productId, quantity);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {pending ? null : <ShoppingCart />} Add to list
    </Button>
  );
}

export function AddAllLowStockButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      disabled={disabled}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await addLowStockToListAction();
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {pending ? null : <ListPlus />} Add all to shopping list
    </Button>
  );
}

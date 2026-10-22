"use client";

import { Heart, ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/lib/actions/recipes";
import { addRecipeMissingToListAction } from "@/lib/actions/shopping";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AddMissingButton({ recipeId, missingCount, canEdit }: { recipeId: string; missingCount: number; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (!canEdit || missingCount === 0) return null;
  return (
    <Button
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await addRecipeMissingToListAction(recipeId);
          if (result.ok) {
            toast.success(result.message, { action: { label: "View list", onClick: () => router.push("/shopping") } });
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {pending ? null : <ListPlus />} Add {missingCount} missing to shopping list
    </Button>
  );
}

export function FavoriteButton({ recipeId, initial }: { recipeId: string; initial: boolean }) {
  const [favorite, setFavorite] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Save to favorites"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !favorite;
          setFavorite(next);
          const result = await toggleFavoriteAction(recipeId, next);
          if (!result.ok) {
            setFavorite(!next);
            toast.error(result.error);
          }
        })
      }
    >
      <Heart className={cn(favorite && "fill-critical text-critical")} />
    </Button>
  );
}

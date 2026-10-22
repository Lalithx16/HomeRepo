"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { deleteCategoryAction } from "@/lib/actions/locations";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { CategoryIcon } from "@/components/shared/icons";
import { CategoryFormDialog } from "@/components/inventory/category-form-dialog";

export function CategoriesPanel({ categories, canEdit }: { categories: Category[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [pending, startTransition] = React.useTransition();

  const remove = (c: Category) =>
    startTransition(async () => {
      const result = await deleteCategoryAction(c.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message);
      setDeleting(null);
      router.refresh();
    });

  return (
    <>
      <ul className="grid gap-1 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
            <span className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
              <CategoryIcon icon={c.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{c.name}</span>
              {c.store_section ? <span className="block truncate text-xs text-muted-foreground">{c.store_section}</span> : null}
            </span>
            {canEdit ? (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                  <Trash2 />
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <Button variant="secondary" className="mt-3" onClick={() => setCreating(true)}>
          <Plus /> New category
        </Button>
      ) : null}
      <CategoryFormDialog
        open={creating || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        editing={editing}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        description="Items in this category stay in your inventory and become “Uncategorized”."
        confirmLabel="Delete category"
        destructive
        pending={pending}
        onConfirm={() => deleting && remove(deleting)}
      />
    </>
  );
}

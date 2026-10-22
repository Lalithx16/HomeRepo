"use client";

import * as React from "react";
import { toast } from "sonner";
import { saveCategoryAction } from "@/lib/actions/locations";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CATEGORY_ICON_NAMES, CategoryIcon } from "@/components/shared/icons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Category | null;
  onSaved?: (category: Category) => void;
}

export function CategoryFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState("package");
  const [section, setSection] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setIcon(editing?.icon ?? "package");
    setSection(editing?.store_section ?? "");
    setErrors({});
  }, [open, editing]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!name.trim()) {
      setErrors({ name: ["Name is required"] });
      return;
    }
    startTransition(async () => {
      const result = await saveCategoryAction({ id: editing?.id, name, icon, storeSection: section });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onSaved?.(result.data);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? "Edit category" : "New category"}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Name" htmlFor="cat-name" required error={errors.name}>
            <Input {...fieldA11y("cat-name", errors.name)} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          </Field>
          <Field label="Store section" htmlFor="cat-section" hint="Groups your shopping list, e.g. “Dairy” or “Aisle 4”.">
            <Input id="cat-section" value={section} onChange={(e) => setSection(e.target.value)} maxLength={60} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">Icon</legend>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  aria-pressed={icon === n}
                  aria-label={n.replace(/-/g, " ")}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                    icon === n ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-transparent text-muted-foreground hover:bg-surface-muted",
                  )}
                >
                  <CategoryIcon icon={n} className="size-4" />
                </button>
              ))}
            </div>
          </fieldset>
          <DialogFooter className="mt-1">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? "Save" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

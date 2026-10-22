"use client";

import * as React from "react";
import { toast } from "sonner";
import { saveLocationAction, type SavedLocation } from "@/lib/actions/locations";
import { validParentOptions } from "@/lib/domain/locations";
import type { LocationKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

export const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  room: "Room",
  storage: "Storage area (pantry, fridge, cabinet)",
  shelf: "Shelf",
  drawer: "Drawer",
  container: "Container / box",
  other: "Other",
};

export interface LocationLite {
  id: string;
  parentId: string | null;
  name: string;
  kind?: string;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationLite[];
  editing?: LocationLite | null;
  defaultParentId?: string | null;
  onSaved?: (location: SavedLocation) => void;
}

export function LocationFormDialog({ open, onOpenChange, locations, editing, defaultParentId, onSaved }: Props) {
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<LocationKind>("storage");
  const [parentId, setParentId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind((editing?.kind as LocationKind) ?? (defaultParentId ? "shelf" : "storage"));
    setParentId(editing ? editing.parentId ?? "" : defaultParentId ?? "");
    setNotes(editing?.notes ?? "");
    setErrors({});
  }, [open, editing, defaultParentId]);

  const parents = validParentOptions(locations, editing?.id);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation(); // never submit an outer form (e.g. the item form)
    if (!name.trim()) {
      setErrors({ name: ["Name is required"] });
      return;
    }
    startTransition(async () => {
      const result = await saveLocationAction({ id: editing?.id, name, kind, parentId: parentId || null, notes });
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
      <DialogContent title={editing ? "Edit location" : "New location"} description="Locations can be nested, e.g. Kitchen › Pantry › Shelf 2.">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Name" htmlFor="loc-name" required error={errors.name}>
            <Input {...fieldA11y("loc-name", errors.name)} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="e.g. Top shelf" />
          </Field>
          <Field label="Inside" htmlFor="loc-parent" error={errors.parentId} hint="Leave empty for a top-level room or area.">
            <NativeSelect {...fieldA11y("loc-parent", errors.parentId, true)} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Nothing — top level</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Type" htmlFor="loc-kind" required>
            <NativeSelect id="loc-kind" value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
              {Object.entries(LOCATION_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notes" htmlFor="loc-notes" error={errors.notes}>
            <Textarea id="loc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </Field>
          <DialogFooter className="mt-1">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? "Save" : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

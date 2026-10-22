"use client";

import { ChevronRight, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { deleteLocationAction, moveLocationContentsAction } from "@/lib/actions/locations";
import { pluralize } from "@/lib/domain/format";
import type { LocationNode } from "@/lib/domain/locations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocationIcon } from "@/components/shared/icons";
import { LocationFormDialog, type LocationLite } from "./location-form-dialog";

type DialogState =
  | { kind: "create"; parentId: string | null }
  | { kind: "edit"; location: LocationLite }
  | { kind: "delete"; location: LocationLite }
  | null;

/** Interactive tree + dialogs. Also used to add/edit/delete from a location page. */
export function LocationManager({
  tree,
  all,
  canEdit,
  showCreateButton = true,
}: {
  tree: LocationNode[];
  all: LocationLite[];
  canEdit: boolean;
  showCreateButton?: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [pending, startTransition] = React.useTransition();

  const remove = (loc: LocationLite) =>
    startTransition(async () => {
      const result = await deleteLocationAction(loc.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDialog(null);
      router.refresh();
    });

  const renderNode = (node: LocationNode) => {
    const lite: LocationLite = { id: node.id, parentId: node.parentId, name: node.name, kind: node.kind };
    return (
      <li key={node.id}>
        <div className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-surface-hover" style={{ paddingLeft: `${node.depth * 20}px` }}>
          <Link href={`/locations/${node.id}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
              <LocationIcon kind={node.kind} name={node.name} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{node.name}</span>
              <span className="block text-xs text-muted-foreground">
                {pluralize(node.totalProductCount, "item")}
                {node.children.length ? ` · ${pluralize(node.children.length, "place")} inside` : ""}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
          </Link>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${node.name}`} disabled={pending}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setDialog({ kind: "create", parentId: node.id })}>
                  <FolderPlus /> Add inside
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", location: lite })}>
                  <Pencil /> Rename or move
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDialog({ kind: "delete", location: lite })}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {node.children.length ? <ul className="flex flex-col">{node.children.map(renderNode)}</ul> : null}
      </li>
    );
  };

  return (
    <>
      {canEdit && showCreateButton ? (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setDialog({ kind: "create", parentId: null })}>
            <Plus /> New location
          </Button>
        </div>
      ) : null}
      {tree.length ? (
        <ul className={cn("flex flex-col gap-0.5")}>{tree.map(renderNode)}</ul>
      ) : null}
      <LocationFormDialog
        open={dialog?.kind === "create" || dialog?.kind === "edit"}
        onOpenChange={(open) => !open && setDialog(null)}
        locations={all}
        editing={dialog?.kind === "edit" ? dialog.location : null}
        defaultParentId={dialog?.kind === "create" ? dialog.parentId : null}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete ${dialog?.kind === "delete" ? dialog.location.name : "location"}?`}
        description="Only empty locations can be deleted. Move its items and sub-locations somewhere else first."
        confirmLabel="Delete location"
        destructive
        pending={pending}
        onConfirm={() => dialog?.kind === "delete" && remove(dialog.location)}
      />
    </>
  );
}

/** Buttons shown on a single location page. */
export function LocationPageActions({
  location,
  all,
  moveTargets,
  hasLots,
}: {
  location: LocationLite;
  all: LocationLite[];
  moveTargets: Array<{ id: string; label: string }>;
  hasLots: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"child" | "edit" | "move" | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/inventory/new?location=${location.id}`}>
            <Plus /> Add item here
          </Link>
        </Button>
        <Button variant="secondary" onClick={() => setDialog("child")}>
          <FolderPlus /> Add inside
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="More location actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setDialog("edit")}>
              <Pencil /> Rename or move
            </DropdownMenuItem>
            {hasLots ? (
              <DropdownMenuItem onSelect={() => setDialog("move")}>
                <ChevronRight /> Move all items…
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <LocationFormDialog
        open={dialog === "child" || dialog === "edit"}
        onOpenChange={(open) => !open && setDialog(null)}
        locations={all}
        editing={dialog === "edit" ? location : null}
        defaultParentId={dialog === "child" ? location.id : null}
        onSaved={() => router.refresh()}
      />
      <MoveContentsDialog open={dialog === "move"} onOpenChange={(o) => !o && setDialog(null)} fromId={location.id} targets={moveTargets} />
    </>
  );
}

function MoveContentsDialog({
  open,
  onOpenChange,
  fromId,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromId: string;
  targets: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [to, setTo] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const submit = () =>
    startTransition(async () => {
      const result = await moveLocationContentsAction(fromId, to);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Move all items" description="Moves every batch stored directly in this location." size="sm">
        <label htmlFor="move-all-to" className="mb-1.5 block text-[13px] font-medium">
          Destination
        </label>
        <NativeSelect id="move-all-to" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Choose a location…</option>
          {targets
            .filter((t) => t.id !== fromId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
        </NativeSelect>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!to} loading={pending}>
            Move items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

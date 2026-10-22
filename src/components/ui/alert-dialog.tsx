"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}

/** In-app confirmation for destructive or irreversible actions (no browser alerts). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  pending,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in" />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-border bg-surface p-5 shadow-raised outline-none data-[state=open]:animate-sheet-in",
            "pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)] sm:max-w-md sm:pb-5 sm:data-[state=open]:animate-pop-in",
          )}
        >
          <AlertDialogPrimitive.Title className="text-[17px] font-semibold tracking-tight">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </AlertDialogPrimitive.Description>
          {children}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: "secondary" })} disabled={pending}>
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <button
              type="button"
              className={buttonVariants({ variant: destructive ? "destructive" : "primary" })}
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

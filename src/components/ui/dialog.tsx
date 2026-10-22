"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Responsive dialog: a bottom sheet on phones, a centered panel on larger screens.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title: string;
    description?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    hideClose?: boolean;
  }
>(function DialogContent({ className, children, title, description, size = "md", hideClose, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-raised outline-none data-[state=open]:animate-sheet-in",
          "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:w-[calc(100%-2rem)] sm:rounded-2xl sm:data-[state=open]:animate-pop-in",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2 sm:pt-5">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          {hideClose ? null : (
            <DialogPrimitive.Close
              className="-mt-1 -mr-2 inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground sm:size-8"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>{children}</div>
  );
}

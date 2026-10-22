"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1 text-sm shadow-raised data-[state=open]:animate-menu-in",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

const itemClass =
  "relative flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50 sm:min-h-9 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(function DropdownMenuItem({ className, destructive, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(itemClass, destructive && "text-critical [&_svg]:text-critical", className)}
      {...props}
    />
  );
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-2.5 flex items-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="!text-primary" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </DropdownMenuPrimitive.RadioItem>
  );
});

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <DropdownMenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}

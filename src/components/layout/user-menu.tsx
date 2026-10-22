"use client";

import { LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import * as React from "react";
import { signOutAction } from "@/lib/actions/auth";
import { IdbQueueStore } from "@/lib/offline/idb-store";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOffline } from "@/components/offline/offline-provider";
import { clearCachedPages } from "@/components/offline/sw-register";

export function initialsOf(name: string | null, email: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (name && parts[1] ? parts[1][0] : "")).toUpperCase();
}

export function UserMenu({
  displayName,
  email,
  collapsed,
  variant = "sidebar",
}: {
  displayName: string | null;
  email: string | null;
  collapsed?: boolean;
  variant?: "sidebar" | "avatar";
}) {
  const { theme, setTheme } = useTheme();
  const { items } = useOffline();
  const [confirm, setConfirm] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const signOut = () => {
    startTransition(async () => {
      try {
        await new IdbQueueStore().clear();
      } catch {
        // ignore
      }
      await clearCachedPages();
      await signOutAction();
    });
  };

  const requestSignOut = () => {
    if (items.length > 0) setConfirm(true);
    else signOut();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-surface-muted",
            variant === "sidebar" ? "w-full px-2 py-2" : "size-11 justify-center rounded-full",
          )}
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary-soft-foreground">
            {initialsOf(displayName, email)}
          </span>
          {variant === "sidebar" ? (
            <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
              <span className="block truncate text-sm font-medium">{displayName || "Your account"}</span>
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-60">
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <Sun /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor /> System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={requestSignOut} disabled={pending}>
            <LogOut /> {pending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Sign out with unsynced changes?"
        description={`${items.length} ${items.length === 1 ? "change hasn't" : "changes haven't"} synced yet. Signing out will discard ${items.length === 1 ? "it" : "them"} from this device.`}
        confirmLabel="Discard and sign out"
        destructive
        pending={pending}
        onConfirm={signOut}
      />
    </>
  );
}

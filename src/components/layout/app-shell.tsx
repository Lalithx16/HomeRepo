"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { HouseholdMembership } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { OfflineBanner, SyncCenter } from "@/components/offline/sync-center";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { AddItemFab, BottomNav } from "./bottom-nav";
import { GlobalSearch } from "./global-search";
import type { NavBadgeKey } from "./nav";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

interface AppShellProps {
  current: HouseholdMembership;
  households: HouseholdMembership[];
  displayName: string | null;
  email: string | null;
  badges: Record<NavBadgeKey, number>;
  canEdit: boolean;
  children: React.ReactNode;
}

export function AppShell({ current, households, displayName, email, badges, canEdit, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OfflineProvider householdId={current.household.id}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar current={current} households={households} displayName={displayName} email={email} badges={badges} />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md pt-safe md:hidden">
            <div className="flex h-14 items-center gap-2 px-4">
              <Link href="/" aria-label="Homebase home" className="mr-auto">
                <Logo />
              </Link>
              <SyncCenter />
              <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setSearchOpen(true)}>
                <Search className="!size-5" />
              </Button>
              <UserMenu displayName={displayName} email={email} variant="avatar" />
            </div>
          </header>
          {/* Desktop header */}
          <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border bg-background/85 px-6 backdrop-blur-md md:flex lg:px-8">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground shadow-card transition-colors hover:border-border-strong"
              aria-label="Search inventory"
            >
              <Search className="size-4" aria-hidden />
              <span className="flex-1 text-left">Search items, brands, locations…</span>
              <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[11px]">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <SyncCenter />
              {canEdit ? (
                <Button asChild>
                  <Link href="/inventory/new">
                    <Plus /> Add item
                  </Link>
                </Button>
              ) : null}
            </div>
          </header>
          <OfflineBanner />
          <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-5 pb-36 sm:px-6 sm:pt-8 md:pb-12 lg:px-8">
            {children}
          </main>
        </div>
      </div>
      <BottomNav badges={badges} />
      {canEdit ? <AddItemFab /> : null}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </OfflineProvider>
  );
}

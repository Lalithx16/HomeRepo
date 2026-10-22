"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { HouseholdMembership } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { HouseholdSwitcher } from "./household-switcher";
import { isActive, PRIMARY_NAV, SETTINGS_NAV, type NavBadgeKey, type NavItem } from "./nav";
import { UserMenu } from "./user-menu";

const STORAGE_KEY = "hb.sidebar.collapsed";

export function Sidebar({
  current,
  households,
  displayName,
  email,
  badges,
}: {
  current: HouseholdMembership;
  households: HouseholdMembership[];
  displayName: string | null;
  email: string | null;
  badges: Record<NavBadgeKey, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      window.localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  // On medium screens the sidebar is always a compact rail; on large screens it's user-collapsible.
  const labelClass = collapsed ? "sr-only" : "sr-only lg:not-sr-only";
  const widthClass = collapsed ? "w-[72px]" : "w-[72px] lg:w-[248px]";

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const count = item.badge ? badges[item.badge] : 0;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          title={item.label}
          className={cn(
            "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors",
            active
              ? "bg-primary-soft font-medium text-primary-soft-foreground"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          )}
        >
          <item.icon className={cn("size-[18px] shrink-0", active ? "text-primary-soft-foreground" : "")} aria-hidden />
          <span className={cn("flex-1 truncate", labelClass)}>{item.label}</span>
          {count > 0 ? (
            <span
              className={cn(
                "tabular rounded-full px-1.5 text-[11px] leading-5 font-medium",
                active ? "bg-surface text-primary-soft-foreground" : "bg-surface-muted text-muted-foreground",
                collapsed ? "absolute top-0.5 right-0.5 min-w-4 px-1 text-[10px] leading-4" : "max-lg:absolute max-lg:top-0.5 max-lg:right-0.5 max-lg:min-w-4 max-lg:px-1 max-lg:text-[10px] max-lg:leading-4",
              )}
            >
              <span className="sr-only">, </span>
              {count > 99 ? "99+" : count}
              <span className="sr-only"> items</span>
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface/70 backdrop-blur-sm transition-[width] duration-200 md:flex",
        widthClass,
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="rounded-lg" aria-label="Homebase home">
          <Logo compact={collapsed} className={cn(!collapsed && "max-lg:[&>span:last-child]:hidden")} />
        </Link>
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "hidden size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground lg:inline-flex",
            collapsed && "lg:hidden",
          )}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-2">
        <HouseholdSwitcher current={current} households={households} collapsed={collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">{PRIMARY_NAV.map(renderItem)}</ul>
      </nav>
      <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
        <ul>{renderItem(SETTINGS_NAV)}</ul>
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            className="hidden h-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground lg:flex"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        ) : null}
        <UserMenu displayName={displayName} email={email} collapsed={collapsed} />
      </div>
    </aside>
  );
}

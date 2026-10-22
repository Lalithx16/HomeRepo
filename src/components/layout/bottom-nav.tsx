"use client";

import { CalendarClock, BarChart3, MapPin, Menu, PackageMinus, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { isActive, MOBILE_TABS, type NavBadgeKey } from "./nav";

const MORE_LINKS = [
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/expiring", label: "Expiring soon", icon: CalendarClock, badge: "expiring" as const },
  { href: "/low-stock", label: "Low stock", icon: PackageMinus, badge: "restock" as const },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav({ badges }: { badges: Record<NavBadgeKey, number> }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));
  const moreCount = badges.expiring + badges.restock;

  React.useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-md pb-safe md:hidden"
        aria-label="Primary"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            const count = tab.badge ? badges[tab.badge] : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <tab.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {tab.label}
                  {count > 0 ? (
                    <span className="tabular absolute top-2 left-1/2 ml-2 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> items</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                moreActive ? "text-primary" : "text-muted-foreground",
              )}
              aria-haspopup="dialog"
            >
              <Menu className="size-[22px]" aria-hidden />
              More
              {moreCount > 0 ? (
                <span className="absolute top-2.5 left-1/2 ml-2.5 size-2 rounded-full bg-warning" aria-label="Items need attention" />
              ) : null}
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="More">
          <ul className="grid grid-cols-1 gap-1">
            {MORE_LINKS.map((link) => {
              const count = link.badge ? badges[link.badge] : 0;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors hover:bg-surface-muted",
                      isActive(pathname, link.href) && "bg-primary-soft text-primary-soft-foreground",
                    )}
                  >
                    <link.icon className="size-5 text-muted-foreground" aria-hidden />
                    <span className="flex-1">{link.label}</span>
                    {count > 0 ? <span className="tabular text-sm text-muted-foreground">{count}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Floating add button on phones; sits above the tab bar and safe area. */
export function AddItemFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/inventory/new") || pathname.endsWith("/edit")) return null;
  return (
    <Link
      href="/inventory/new"
      className="fixed right-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-fab transition-transform active:scale-95 md:hidden"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 1rem)" }}
      aria-label="Add item"
    >
      <Plus className="size-6" aria-hidden />
    </Link>
  );
}

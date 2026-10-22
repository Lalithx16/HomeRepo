"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { switchHouseholdAction } from "@/lib/actions/household";
import type { HouseholdMembership } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

export function HouseholdSwitcher({
  current,
  households,
  collapsed,
}: {
  current: HouseholdMembership;
  households: HouseholdMembership[];
  collapsed?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const select = (id: string) => {
    if (id === current.household.id) return;
    startTransition(async () => {
      const result = await switchHouseholdAction(id);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  };

  const initial = current.household.name.trim().charAt(0).toUpperCase() || "H";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-muted",
          pending && "opacity-60",
        )}
        aria-label={`Household: ${current.household.name}. Switch household`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[13px] font-semibold text-foreground">
          {initial}
        </span>
        <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
          <span className="block truncate text-sm font-medium">{current.household.name}</span>
          <span className="block text-xs text-muted-foreground">{ROLE_LABEL[current.role]}</span>
        </span>
        <ChevronsUpDown className={cn("size-4 shrink-0 text-muted-foreground", collapsed && "hidden")} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Households</DropdownMenuLabel>
        {households.map((m) => (
          <DropdownMenuItem key={m.household.id} onSelect={() => select(m.household.id)}>
            <span className="min-w-0 flex-1 truncate">{m.household.name}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
            {m.household.id === current.household.id ? <Check className="!text-primary" aria-label="Current" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding?new=1")}>
          <Plus />
          New household
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

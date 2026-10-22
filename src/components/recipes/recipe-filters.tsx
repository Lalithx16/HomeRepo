import Link from "next/link";
import { cn } from "@/lib/utils";

export interface RecipeFilterState {
  filter: "all" | "ready" | "almost" | "favorites";
  time: number | null;
  diet: string | null;
}

function hrefWith(state: RecipeFilterState, change: Partial<RecipeFilterState>): string {
  const next = { ...state, ...change };
  const qs = new URLSearchParams();
  if (next.filter !== "all") qs.set("filter", next.filter);
  if (next.time) qs.set("time", String(next.time));
  if (next.diet) qs.set("diet", next.diet);
  const s = qs.toString();
  return s ? `/recipes?${s}` : "/recipes";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-full border px-3.5 text-[13px] transition-colors sm:h-8",
        active ? "border-primary bg-primary-soft font-medium text-primary-soft-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function RecipeFilters({ state, diets, counts }: { state: RecipeFilterState; diets: string[]; counts: Record<RecipeFilterState["filter"], number> }) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Availability">
        <Chip href={hrefWith(state, { filter: "all" })} active={state.filter === "all"}>
          All ({counts.all})
        </Chip>
        <Chip href={hrefWith(state, { filter: "ready" })} active={state.filter === "ready"}>
          Ready to make ({counts.ready})
        </Chip>
        <Chip href={hrefWith(state, { filter: "almost" })} active={state.filter === "almost"}>
          Missing 1–2 ({counts.almost})
        </Chip>
        <Chip href={hrefWith(state, { filter: "favorites" })} active={state.filter === "favorites"}>
          Favorites ({counts.favorites})
        </Chip>
      </div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Time and diet">
        {[15, 30, 60].map((t) => (
          <Chip key={t} href={hrefWith(state, { time: state.time === t ? null : t })} active={state.time === t}>
            ≤ {t} min
          </Chip>
        ))}
        <span className="mx-1 hidden w-px self-stretch bg-border sm:block" aria-hidden />
        {diets.map((d) => (
          <Chip key={d} href={hrefWith(state, { diet: state.diet === d ? null : d })} active={state.diet === d}>
            {d.charAt(0).toUpperCase() + d.slice(1).replace("-", " ")}
          </Chip>
        ))}
      </div>
    </div>
  );
}

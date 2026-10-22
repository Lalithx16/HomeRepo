import { CheckCircle2, CircleDashed, Clock, Gauge } from "lucide-react";
import Link from "next/link";
import type { RecipeMatch } from "@/lib/domain/recipes";
import type { RecipeRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/shared/icons";

const DIFFICULTY = { easy: "Easy", medium: "Medium", hard: "Involved" } as const;

export function AvailabilityLabel({ match }: { match: RecipeMatch }) {
  if (match.availability === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 className="size-3.5" aria-hidden /> Ready to make
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", match.availability === "partial" ? "text-warning" : "text-muted-foreground")}>
      <CircleDashed className="size-3.5" aria-hidden />
      Missing {match.missingCount} {match.missingCount === 1 ? "ingredient" : "ingredients"}
    </span>
  );
}

export function RecipeVisual({ recipe, className }: { recipe: Pick<RecipeRow, "icon" | "image_url" | "name">; className?: string }) {
  if (recipe.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={recipe.image_url} alt="" className={cn("h-full w-full object-cover", className)} loading="lazy" />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-full w-full items-center justify-center bg-linear-to-br from-primary-soft to-surface-muted text-primary-soft-foreground [&_svg]:size-9 [&_svg]:opacity-80",
        className,
      )}
    >
      <CategoryIcon icon={recipe.icon} />
    </div>
  );
}

export function RecipeCard({ recipe, match, compact = false }: { recipe: RecipeRow; match: RecipeMatch; compact?: boolean }) {
  const total = recipe.prep_minutes + recipe.cook_minutes;
  const ingredients = recipe.recipe_ingredients.filter((i) => !i.optional);
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-colors hover:border-border-strong"
    >
      <div className={cn("overflow-hidden", compact ? "h-24" : "h-32")}>
        <RecipeVisual recipe={recipe} className="transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="text-[15px] leading-snug font-semibold">{recipe.name}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {total} min
              <span className="sr-only">
                ({recipe.prep_minutes} prep, {recipe.cook_minutes} cook)
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Gauge className="size-3.5" aria-hidden /> {DIFFICULTY[recipe.difficulty]}
            </span>
          </div>
        </div>
        {!compact ? (
          <p className="line-clamp-2 text-[13px] text-muted-foreground">
            {ingredients.map((i) => i.display_name).join(", ")}
          </p>
        ) : null}
        <div className="mt-auto pt-1">
          <AvailabilityLabel match={match} />
        </div>
      </div>
    </Link>
  );
}

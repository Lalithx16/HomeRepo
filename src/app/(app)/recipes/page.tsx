import { ChefHat } from "lucide-react";
import Link from "next/link";
import { requireContext } from "@/lib/data/context";
import { getMatchedRecipes, listFavoriteRecipeIds } from "@/lib/data/recipes";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { RecipeFilters, type RecipeFilterState } from "@/components/recipes/recipe-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Recipes" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [ctx, params] = await Promise.all([requireContext(), searchParams]);
  const [matched, favorites] = await Promise.all([getMatchedRecipes(ctx), listFavoriteRecipeIds(ctx)]);

  const filter = (["ready", "almost", "favorites"] as const).find((f) => f === params.filter) ?? "all";
  const time = [15, 30, 60].includes(Number(params.time)) ? Number(params.time) : null;
  const diets = [...new Set(matched.flatMap((m) => m.recipe.diets))].sort();
  const diet = params.diet && diets.includes(params.diet) ? params.diet : null;
  const state: RecipeFilterState = { filter, time, diet };

  const byTimeDiet = matched.filter(
    (m) => (!time || m.recipe.prep_minutes + m.recipe.cook_minutes <= time) && (!diet || m.recipe.diets.includes(diet)),
  );
  const isAlmost = (m: (typeof matched)[number]) => m.match.missingCount >= 1 && m.match.missingCount <= 2;
  const counts = {
    all: byTimeDiet.length,
    ready: byTimeDiet.filter((m) => m.match.availability === "ready").length,
    almost: byTimeDiet.filter(isAlmost).length,
    favorites: byTimeDiet.filter((m) => favorites.has(m.recipe.id)).length,
  };
  const shown = byTimeDiet.filter((m) =>
    filter === "ready" ? m.match.availability === "ready" : filter === "almost" ? isAlmost(m) : filter === "favorites" ? favorites.has(m.recipe.id) : true,
  );

  return (
    <>
      <PageHeader title="Recipes" description="Matched against what's actually in stock — quantities and units included. Expired items don't count." />
      <RecipeFilters state={state} diets={diets} counts={counts} />
      {shown.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title={filter === "ready" ? "Nothing fully stocked yet" : "No recipes match"}
          description={
            filter === "ready"
              ? "Try “Missing 1–2” to see recipes that only need a quick top-up."
              : "Try removing a filter."
          }
          action={
            <Link href="/recipes" className="text-sm font-medium text-primary hover:underline">
              Show all recipes
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ recipe, match }) => (
            <li key={recipe.id} className="flex">
              <div className="flex w-full flex-col [&>a]:flex-1">
                <RecipeCard recipe={recipe} match={match} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

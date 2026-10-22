import { AlertCircle, CheckCircle2, ChevronLeft, CircleDashed, Clock, Gauge, HelpCircle, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/data/context";
import { getInventoryForMatching, getRecipeBySlug, listFavoriteRecipeIds, toRecipeInput } from "@/lib/data/recipes";
import { matchRecipe, type IngredientMatch } from "@/lib/domain/recipes";
import { formatQuantity } from "@/lib/domain/units";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { AvailabilityLabel, RecipeVisual } from "@/components/recipes/recipe-card";
import { AddMissingButton, FavoriteButton } from "@/components/recipes/recipe-actions";

export const metadata = { title: "Recipe" };

const DIFFICULTY = { easy: "Easy", medium: "Medium", hard: "Involved" } as const;

function IngredientStatus({ m }: { m: IngredientMatch }) {
  const need = m.ingredient.quantity !== null && m.ingredient.unit ? formatQuantity(m.ingredient.quantity, m.ingredient.unit) : "to taste";
  let icon = <CheckCircle2 className="size-4 text-success" aria-hidden />;
  let status = "In stock";
  let detail: string | null = m.productNames.length ? `Using ${m.productNames.join(", ")}` : null;
  if (m.status === "insufficient") {
    icon = <AlertCircle className="size-4 text-warning" aria-hidden />;
    status = `Short by ${formatQuantity(m.shortfall, m.ingredient.unit ?? "pcs")}`;
    detail = `You have ${formatQuantity(m.available ?? 0, m.ingredient.unit ?? "pcs")}`;
  } else if (m.status === "missing") {
    icon = m.ingredient.optional ? <CircleDashed className="size-4 text-muted-foreground" aria-hidden /> : <CircleDashed className="size-4 text-critical" aria-hidden />;
    status = m.ingredient.optional ? "Optional · not in stock" : "Missing";
    detail = null;
  } else if (m.status === "unverified") {
    icon = <HelpCircle className="size-4 text-info" aria-hidden />;
    status = "Can't compare units";
    detail = `${m.productNames.join(", ")} is tracked in a different unit — check you have enough.`;
  } else if (m.status === "staple") {
    status = "In stock";
  }
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{m.ingredient.displayName}</span>
          {m.ingredient.optional ? <span className="text-muted-foreground"> (optional)</span> : null}
        </p>
        <p className={cn("text-xs", m.status === "missing" && !m.ingredient.optional ? "text-critical" : m.status === "insufficient" ? "text-warning" : "text-muted-foreground")}>
          {status}
          {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
        </p>
      </div>
      <span className="tabular shrink-0 text-sm text-muted-foreground">{need}</span>
    </li>
  );
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, ctx] = await Promise.all([params, requireContext()]);
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const recipe = await getRecipeBySlug(ctx, slug);
  if (!recipe) notFound();
  const [lots, favorites] = await Promise.all([getInventoryForMatching(ctx), listFavoriteRecipeIds(ctx)]);
  const match = matchRecipe(toRecipeInput(recipe), lots);
  const missing = match.ingredients.filter((m) => !m.ingredient.optional && m.status !== "available" && m.status !== "staple");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/recipes" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Recipes
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="h-48 overflow-hidden rounded-2xl border border-border sm:h-64">
          <RecipeVisual recipe={recipe} />
        </div>
        <div className="flex flex-col justify-center">
          {recipe.cuisine ? <p className="text-sm text-muted-foreground">{recipe.cuisine}</p> : null}
          <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">{recipe.name}</h1>
          {recipe.description ? <p className="mt-2 text-[15px] text-muted-foreground">{recipe.description}</p> : null}
          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Time</dt>
              <dd>
                {recipe.prep_minutes} min prep · {recipe.cook_minutes} min cook
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Gauge className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Difficulty</dt>
              <dd>{DIFFICULTY[recipe.difficulty]}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Servings</dt>
              <dd>Serves {recipe.servings}</dd>
            </div>
          </dl>
          {recipe.diets.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recipe.diets.map((d) => (
                <span key={d} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {d.replace("-", " ")}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <AvailabilityLabel match={match} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AddMissingButton recipeId={recipe.id} missingCount={missing.length} canEdit={ctx.canEdit} />
            <FavoriteButton recipeId={recipe.id} initial={favorites.has(recipe.id)} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader
            title="Ingredients"
            description={`${match.coveredCount} of ${match.requiredCount} required ingredients in stock`}
          />
          <ul className="mt-2 divide-y divide-border">
            {match.ingredients.map((m) => (
              <IngredientStatus key={m.ingredient.id} m={m} />
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Method" />
          <ol className="flex flex-col gap-4 p-4 sm:px-5">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-soft-foreground">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-[15px] leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

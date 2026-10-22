"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { uuid } from "@/lib/validation/schemas";
import { dbFail, memberContext, revalidateApp } from "./helpers";

export async function toggleFavoriteAction(recipeId: string, favorite: boolean): Promise<ActionResult<null>> {
  const guarded = await memberContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(recipeId).success) return fail("validation", "Invalid recipe.");
  const { error } = favorite
    ? await ctx.supabase
        .from("recipe_favorites")
        .upsert(
          { household_id: ctx.household.id, recipe_id: recipeId, user_id: ctx.user.id },
          { onConflict: "household_id,recipe_id,user_id", ignoreDuplicates: true },
        )
    : await ctx.supabase
        .from("recipe_favorites")
        .delete()
        .eq("household_id", ctx.household.id)
        .eq("recipe_id", recipeId)
        .eq("user_id", ctx.user.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, favorite ? "Saved to favorites" : "Removed from favorites");
}

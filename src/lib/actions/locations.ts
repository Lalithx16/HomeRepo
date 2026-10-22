"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { wouldCreateCycle } from "@/lib/domain/locations";
import { categorySchema, locationSchema, uuid } from "@/lib/validation/schemas";
import type { Category } from "@/lib/types";
import { dbFail, editorContext, revalidateApp, validationFail } from "./helpers";

export interface SavedLocation {
  id: string;
  name: string;
  parent_id: string | null;
  kind: string;
}

export async function saveLocationAction(input: unknown): Promise<ActionResult<SavedLocation>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;

  if (v.id && v.parentId) {
    const { data: all } = await ctx.supabase.from("locations").select("id, parent_id").eq("household_id", ctx.household.id);
    const nodes = (all ?? []).map((l: { id: string; parent_id: string | null }) => ({ id: l.id, parentId: l.parent_id }));
    if (wouldCreateCycle(nodes, v.id, v.parentId)) {
      return fail("validation", "A location can't be placed inside itself or one of its sub-locations.", {
        fieldErrors: { parentId: ["Choose a different parent"] },
      });
    }
  }

  const row = { name: v.name, kind: v.kind, parent_id: v.parentId ?? null, notes: v.notes ?? null };
  const query = v.id
    ? ctx.supabase.from("locations").update(row).eq("id", v.id).eq("household_id", ctx.household.id)
    : ctx.supabase.from("locations").insert({ ...row, household_id: ctx.household.id });
  const { data, error } = await query.select("id, name, parent_id, kind").single();
  if (error) {
    if (error.code === "23505") {
      return fail("duplicate", "There's already a location with that name here.", { fieldErrors: { name: ["Name already used here"] } });
    }
    return dbFail(error);
  }
  revalidateApp();
  return ok(data as SavedLocation, v.id ? "Location updated" : `${v.name} created`);
}

export async function deleteLocationAction(id: string): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(id).success) return fail("validation", "Invalid location.");

  const [children, lots] = await Promise.all([
    ctx.supabase.from("locations").select("id", { count: "exact", head: true }).eq("parent_id", id),
    ctx.supabase.from("inventory_lots").select("id", { count: "exact", head: true }).eq("location_id", id),
  ]);
  if ((children.count ?? 0) > 0) return fail("conflict", "Move or delete the locations inside this one first.");
  if ((lots.count ?? 0) > 0) return fail("conflict", "Move the items stored here to another location first.");

  const { error } = await ctx.supabase.from("locations").delete().eq("id", id).eq("household_id", ctx.household.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Location deleted");
}

/** Moves every batch stored directly in one location to another. */
export async function moveLocationContentsAction(fromId: string, toId: string): Promise<ActionResult<{ moved: number }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(fromId).success || !uuid.safeParse(toId).success) return fail("validation", "Invalid location.");
  if (fromId === toId) return fail("validation", "Choose a different destination.");
  const { data: lots, error } = await ctx.supabase.from("inventory_lots").select("id").eq("location_id", fromId);
  if (error) return dbFail(error);
  let moved = 0;
  for (const lot of (lots ?? []) as Array<{ id: string }>) {
    const { error: moveError } = await ctx.supabase.rpc("move_lot", { p_lot_id: lot.id, p_to_location: toId, p_quantity: null, p_note: null });
    if (moveError) {
      revalidateApp();
      return dbFail(moveError, `Moved ${moved} batches, then something went wrong.`);
    }
    moved += 1;
  }
  revalidateApp();
  return ok({ moved }, `Moved ${moved} ${moved === 1 ? "batch" : "batches"}`);
}

export async function saveCategoryAction(input: unknown): Promise<ActionResult<Category>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const row = { name: v.name, icon: v.icon, store_section: v.storeSection ?? null };
  const query = v.id
    ? ctx.supabase.from("categories").update(row).eq("id", v.id).eq("household_id", ctx.household.id)
    : ctx.supabase.from("categories").insert({ ...row, household_id: ctx.household.id, sort_order: 500 });
  const { data, error } = await query.select("id, name, icon, store_section, sort_order").single();
  if (error) {
    if (error.code === "23505") {
      return fail("duplicate", "A category with that name already exists.", { fieldErrors: { name: ["Name already used"] } });
    }
    return dbFail(error);
  }
  revalidateApp();
  return ok(data as Category, v.id ? "Category updated" : `${v.name} created`);
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  if (!uuid.safeParse(id).success) return fail("validation", "Invalid category.");
  // Products keep existing and become "Uncategorized" (ON DELETE SET NULL).
  const { error } = await guarded.ctx.supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("household_id", guarded.ctx.household.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Category deleted");
}

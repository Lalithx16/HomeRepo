"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { escapeLike } from "@/lib/domain/format";
import { suggestedRestock } from "@/lib/domain/stock";
import { getDefaultList } from "@/lib/data/shopping";
import { getProduct } from "@/lib/data/inventory";
import {
  addStockSchema,
  adjustLotSchema,
  consumeProductSchema,
  createItemSchema,
  formDataToObject,
  moveLotSchema,
  ratingSchema,
  setLotQuantitySchema,
  updateLotSchema,
  updateProductSchema,
  uuid,
} from "@/lib/validation/schemas";
import { dbFail, editorContext, memberContext, revalidateApp, validationFail } from "./helpers";
import { removeItemImage, uploadItemImage } from "./images";

/** Create a product with its first batch — or add a batch to an existing product. */
export async function createItemAction(formData: FormData): Promise<ActionResult<{ productId: string }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;

  const parsed = createItemSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationFail(parsed.error);
  const input = parsed.data;
  const locationId = input.locationId as string;

  // Adding a new batch to a product that already exists.
  if (input.existingProductId) {
    if (input.quantity <= 0) return fail("validation", "Enter how much you're adding.", { fieldErrors: { quantity: ["Enter how much you're adding"] } });
    const { error } = await ctx.supabase.rpc("add_stock", {
      p_product_id: input.existingProductId,
      p_location_id: locationId,
      p_quantity: input.quantity,
      p_unit: input.unit,
      p_expiry_date: input.expiryDate ?? null,
      p_purchase_date: input.purchaseDate ?? null,
      p_total_price: input.price ?? null,
      p_kind: input.purchaseDate || input.price != null ? "purchase" : "add",
    });
    if (error) return dbFail(error);
    revalidateApp();
    return ok({ productId: input.existingProductId }, "Added to existing item");
  }

  // Duplicate detection: same name (case-insensitive) and same brand.
  if (!input.confirmDuplicate) {
    const { data: sameName } = await ctx.supabase
      .from("products")
      .select("id, name, brand:brands(name)")
      .eq("household_id", ctx.household.id)
      .ilike("name", escapeLike(input.name))
      .limit(5);
    const brand = (input.brand ?? "").trim().toLowerCase();
    const match = (sameName ?? []).find(
      (p: { brand: { name: string } | null }) => (p.brand?.name ?? "").toLowerCase() === brand,
    ) as { id: string; name: string } | undefined;
    if (match) {
      return fail("duplicate", `You already track “${match.name}”. Add this as a new batch instead?`, {
        meta: { productId: match.id, productName: match.name },
      });
    }
  }

  const image = await uploadItemImage(ctx, formData.get("image"));
  if (image.error) return fail("validation", image.error, { fieldErrors: { image: [image.error] } });

  const { data: productId, error } = await ctx.supabase.rpc("create_item", {
    p_household: ctx.household.id,
    p_name: input.name,
    p_brand_name: input.brand ?? null,
    p_category_id: input.categoryId ?? null,
    p_unit: input.unit,
    p_quantity: input.quantity,
    p_location_id: locationId,
    p_expiry_date: input.expiryDate ?? null,
    p_purchase_date: input.purchaseDate ?? null,
    p_total_price: input.price ?? null,
    p_min_quantity: input.minQuantity ?? null,
    p_target_quantity: input.targetQuantity ?? null,
    p_ingredient_key: input.ingredientKey ?? null,
    p_notes: input.notes ?? null,
    p_image_path: image.path,
  });
  if (error) {
    await removeItemImage(ctx, image.path);
    if (error.code === "23505") {
      return fail("duplicate", "An item with this name and brand already exists.");
    }
    return dbFail(error);
  }
  revalidateApp();
  return ok({ productId: productId as string }, `${input.name} added`);
}

export async function updateProductAction(formData: FormData): Promise<ActionResult<{ productId: string }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;

  const parsed = updateProductSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationFail(parsed.error);
  const input = parsed.data;

  const existing = await getProduct(ctx, input.productId);
  if (!existing) return fail("not_found", "This item no longer exists.");

  const image = await uploadItemImage(ctx, formData.get("image"));
  if (image.error) return fail("validation", image.error, { fieldErrors: { image: [image.error] } });

  const { error } = await ctx.supabase.rpc("update_product", {
    p_product_id: input.productId,
    p_expected_version: input.version,
    p_name: input.name,
    p_brand_name: input.brand ?? null,
    p_category_id: input.categoryId ?? null,
    p_unit: input.unit,
    p_min_quantity: input.minQuantity ?? null,
    p_target_quantity: input.targetQuantity ?? null,
    p_ingredient_key: input.ingredientKey ?? null,
    p_notes: input.notes ?? null,
    p_image_path: image.path,
    p_clear_image: input.clearImage ?? false,
  });
  if (error) {
    await removeItemImage(ctx, image.path);
    if (error.code === "23505") return fail("duplicate", "Another item already has this name and brand.");
    return dbFail(error);
  }
  if ((image.path || input.clearImage) && existing.image_path && existing.image_path !== image.path) {
    await removeItemImage(ctx, existing.image_path);
  }
  revalidateApp();
  return ok({ productId: input.productId }, "Changes saved");
}

export async function deleteProductAction(productId: string): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(productId).success) return fail("validation", "Invalid item.");

  const existing = await getProduct(ctx, productId);
  if (!existing) return fail("not_found", "This item no longer exists.");

  const { error } = await ctx.supabase.from("products").delete().eq("id", productId).eq("household_id", ctx.household.id);
  if (error) return dbFail(error);
  await removeItemImage(ctx, existing.image_path);
  revalidateApp();
  return ok(null, `${existing.name} deleted`);
}

export async function addStockAction(input: unknown): Promise<ActionResult<{ lotId: string }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = addStockSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { data, error } = await guarded.ctx.supabase.rpc("add_stock", {
    p_product_id: v.productId,
    p_location_id: v.locationId,
    p_quantity: v.quantity,
    p_unit: v.unit,
    p_expiry_date: v.expiryDate ?? null,
    p_purchase_date: v.purchaseDate ?? null,
    p_total_price: v.price ?? null,
    p_note: v.note ?? null,
    p_kind: v.purchaseDate || v.price != null ? "purchase" : "add",
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok({ lotId: data as string }, "Stock added");
}

export async function adjustLotAction(input: unknown): Promise<ActionResult<{ quantity: number }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = adjustLotSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const delta = v.kind === "add" ? v.amount : -v.amount;
  const { data, error } = await guarded.ctx.supabase.rpc("adjust_lot", {
    p_lot_id: v.lotId,
    p_delta: delta,
    p_kind: v.kind,
    p_note: v.note ?? null,
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok({ quantity: Number((data as { quantity: number }).quantity) }, v.kind === "add" ? "Quantity increased" : "Quantity updated");
}

export async function setLotQuantityAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = setLotQuantitySchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { error } = await guarded.ctx.supabase.rpc("set_lot_quantity", {
    p_lot_id: v.lotId,
    p_quantity: v.quantity,
    p_expected_version: v.version ?? null,
    p_note: v.note ?? null,
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Count corrected");
}

export async function moveLotAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = moveLotSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { error } = await guarded.ctx.supabase.rpc("move_lot", {
    p_lot_id: v.lotId,
    p_to_location: v.toLocationId,
    p_quantity: v.quantity ?? null,
    p_note: v.note ?? null,
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Moved");
}

export async function updateLotAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = updateLotSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { data, error } = await guarded.ctx.supabase
    .from("inventory_lots")
    .update({ expiry_date: v.expiryDate ?? null, purchase_date: v.purchaseDate ?? null, notes: v.notes ?? null })
    .eq("id", v.lotId)
    .eq("household_id", guarded.ctx.household.id)
    .eq("version", v.version)
    .select("id");
  if (error) return dbFail(error);
  if (!data || data.length === 0) {
    return fail("conflict", "This batch was changed elsewhere. Reload to see the latest version.");
  }
  revalidateApp();
  return ok(null, "Batch updated");
}

export async function removeLotAction(lotId: string): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  if (!uuid.safeParse(lotId).success) return fail("validation", "Invalid batch.");
  const { error } = await guarded.ctx.supabase.rpc("remove_lot", { p_lot_id: lotId, p_note: null });
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Batch removed");
}

export async function consumeProductAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const parsed = consumeProductSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { error } = await guarded.ctx.supabase.rpc("consume_product", {
    p_product_id: v.productId,
    p_quantity: v.quantity,
    p_unit: v.unit,
    p_note: v.note ?? null,
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Marked as used");
}

/** Adds a product to the shopping list, defaulting to the suggested restock amount. */
export async function addProductToShoppingAction(productId: string, quantity?: number): Promise<ActionResult<null>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(productId).success) return fail("validation", "Invalid item.");
  const product = await getProduct(ctx, productId);
  if (!product) return fail("not_found", "This item no longer exists.");
  const list = await getDefaultList(ctx);
  if (!list) return fail("not_found", "No shopping list found for this household.");

  const rule = product.min_quantity != null ? { minQuantity: product.min_quantity, targetQuantity: product.target_quantity } : null;
  const suggested = suggestedRestock(product.total_quantity, rule, product.default_unit, ctx.household.restock_multiplier);
  const amount = quantity && quantity > 0 ? quantity : suggested > 0 ? suggested : 1;

  const { error } = await ctx.supabase.rpc("upsert_shopping_item", {
    p_list_id: list.id,
    p_name: product.name,
    p_quantity: amount,
    p_unit: product.default_unit,
    p_product_id: product.id,
    p_category_id: product.category_id,
    p_source: product.needs_restock ? "low_stock" : "manual",
  });
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, `${product.name} added to shopping list`);
}

export async function rateAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await memberContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const table = v.target === "product" ? "product_ratings" : "brand_ratings";
  const key = v.target === "product" ? "product_id" : "brand_id";
  const { error } = await ctx.supabase.from(table).upsert(
    {
      household_id: ctx.household.id,
      [key]: v.targetId,
      user_id: ctx.user.id,
      rating: v.rating,
      notes: v.notes ?? null,
    },
    { onConflict: `${key},user_id` },
  );
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Rating saved");
}

export async function deleteRatingAction(target: "product" | "brand", targetId: string): Promise<ActionResult<null>> {
  const guarded = await memberContext();
  if (guarded.error) return guarded.error;
  if (!uuid.safeParse(targetId).success) return fail("validation", "Invalid item.");
  const table = target === "product" ? "product_ratings" : "brand_ratings";
  const key = target === "product" ? "product_id" : "brand_id";
  const { error } = await guarded.ctx.supabase.from(table).delete().eq(key, targetId).eq("user_id", guarded.ctx.user.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Rating removed");
}

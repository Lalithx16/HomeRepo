import type { AppContext } from "@/lib/data/context";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type ImageUploadResult = { path: string | null; error?: string };

/** Uploads an optional photo to the private bucket under the household folder. */
export async function uploadItemImage(ctx: AppContext, file: FormDataEntryValue | null): Promise<ImageUploadResult> {
  if (!file || typeof file === "string" || file.size === 0) return { path: null };
  const ext = TYPES[file.type];
  if (!ext) return { path: null, error: "Photos must be JPEG, PNG or WebP." };
  if (file.size > MAX_BYTES) return { path: null, error: "Photos must be 5 MB or smaller." };
  const path = `${ctx.household.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await ctx.supabase.storage
    .from("item-images")
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) return { path: null, error: "The photo could not be uploaded. Try again or save without a photo." };
  return { path };
}

export async function removeItemImage(ctx: AppContext, path: string | null | undefined): Promise<void> {
  if (!path || !path.startsWith(`${ctx.household.id}/`)) return;
  await ctx.supabase.storage.from("item-images").remove([path]);
}

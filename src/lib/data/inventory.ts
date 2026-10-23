import { escapeLike } from "@/lib/domain/format";
import { getDescendantIds } from "@/lib/domain/locations";
import type { AppContext } from "./context";
import {
  num,
  numOrNull,
  type LotDetailRow,
  type ProductStockRow,
  type TransactionRow,
} from "@/lib/types";

export const INVENTORY_PAGE_SIZE = 24;

export type InventorySort = "name" | "quantity" | "expiry" | "updated" | "category";
export const INVENTORY_SORTS: Array<{ value: InventorySort; label: string }> = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name" },
  { value: "expiry", label: "Expiry date" },
  { value: "quantity", label: "Quantity" },
  { value: "category", label: "Category" },
];

export interface InventoryFilters {
  q?: string;
  category?: string;
  location?: string;
  stock?: "ok" | "low" | "out" | "restock";
  expiry?: "expired" | "expiring" | "fresh" | "none";
  sort?: InventorySort;
  page?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses untrusted URL search params into safe filters. */
export function parseInventoryFilters(params: Record<string, string | string[] | undefined>): InventoryFilters {
  const get = (k: string) => {
    const v = params[k];
    return typeof v === "string" ? v : undefined;
  };
  const sort = get("sort");
  const stock = get("stock");
  const expiry = get("expiry");
  const page = Number(get("page") ?? "1");
  return {
    q: get("q")?.trim().slice(0, 80) || undefined,
    category: get("category") && UUID.test(get("category")!) ? get("category") : undefined,
    location: get("location") && UUID.test(get("location")!) ? get("location") : undefined,
    stock: stock === "ok" || stock === "low" || stock === "out" || stock === "restock" ? stock : undefined,
    expiry: expiry === "expired" || expiry === "expiring" || expiry === "fresh" || expiry === "none" ? expiry : undefined,
    sort: INVENTORY_SORTS.some((s) => s.value === sort) ? (sort as InventorySort) : "updated",
    page: Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

export function normalizeProduct(row: Record<string, unknown>): ProductStockRow {
  const r = row as unknown as ProductStockRow;
  return {
    ...r,
    total_quantity: num(r.total_quantity),
    min_quantity: numOrNull(r.min_quantity),
    target_quantity: numOrNull(r.target_quantity),
    single_lot_quantity: numOrNull(r.single_lot_quantity),
    lot_count: num(r.lot_count),
    all_lot_count: num(r.all_lot_count),
    location_ids: r.location_ids ?? [],
  };
}

export function normalizeLot(row: Record<string, unknown>): LotDetailRow {
  const r = row as unknown as LotDetailRow;
  return { ...r, quantity: num(r.quantity), days_until_expiry: numOrNull(r.days_until_expiry) };
}

export async function listInventory(
  ctx: AppContext,
  filters: InventoryFilters,
  allLocations: Array<{ id: string; parentId: string | null }>,
): Promise<{ items: ProductStockRow[]; total: number; pageSize: number; error: string | null }> {
  const page = filters.page ?? 1;
  let query = ctx.supabase
    .from("product_stock")
    .select("*", { count: "exact" })
    .eq("household_id", ctx.household.id);

  if (filters.q) query = query.ilike("search_text", `%${escapeLike(filters.q.toLowerCase())}%`);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.location) {
    // Include everything stored in nested sub-locations.
    query = query.overlaps("location_ids", getDescendantIds(allLocations, filters.location));
  }
  if (filters.stock === "restock") query = query.eq("needs_restock", true);
  else if (filters.stock) query = query.eq("stock_status", filters.stock);
  if (filters.expiry) query = query.eq("expiry_status", filters.expiry);

  switch (filters.sort) {
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "quantity":
      query = query.order("total_quantity", { ascending: true }).order("name");
      break;
    case "expiry":
      query = query.order("earliest_expiry", { ascending: true, nullsFirst: false }).order("name");
      break;
    case "category":
      query = query.order("category_name", { ascending: true, nullsFirst: false }).order("name");
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }

  const from = (page - 1) * INVENTORY_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + INVENTORY_PAGE_SIZE - 1);
  if (error) return { items: [], total: 0, pageSize: INVENTORY_PAGE_SIZE, error: "Could not load inventory." };
  return { items: (data ?? []).map(normalizeProduct), total: count ?? 0, pageSize: INVENTORY_PAGE_SIZE, error: null };
}

export async function getProduct(ctx: AppContext, id: string): Promise<ProductStockRow | null> {
  const { data } = await ctx.supabase
    .from("product_stock")
    .select("*")
    .eq("household_id", ctx.household.id)
    .eq("id", id)
    .maybeSingle();
  return data ? normalizeProduct(data) : null;
}

export async function getProductLots(ctx: AppContext, productId: string): Promise<LotDetailRow[]> {
  const { data } = await ctx.supabase
    .from("lot_details")
    .select("*")
    .eq("household_id", ctx.household.id)
    .eq("product_id", productId)
    .order("quantity", { ascending: false })
    .order("expiry_date", { ascending: true, nullsFirst: false });
  return (data ?? []).map(normalizeLot);
}

export async function getTransactions(
  ctx: AppContext,
  opts: { productId?: string; limit?: number } = {},
): Promise<TransactionRow[]> {
  let query = ctx.supabase
    .from("inventory_transactions")
    .select(
      "id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after, from_location_id, to_location_id, total_price, note, created_by, created_at",
    )
    .eq("household_id", ctx.household.id)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.productId) query = query.eq("product_id", opts.productId);
  const { data } = await query;
  return (data ?? []).map((r: TransactionRow) => ({
    ...r,
    quantity_delta: num(r.quantity_delta),
    quantity_after: numOrNull(r.quantity_after),
    total_price: numOrNull(r.total_price),
  }));
}

export async function listExpiringLots(ctx: AppContext, horizonDays: number): Promise<LotDetailRow[]> {
  const { data } = await ctx.supabase
    .from("lot_details")
    .select("*")
    .eq("household_id", ctx.household.id)
    .gt("quantity", 0)
    .not("expiry_date", "is", null)
    .lte("days_until_expiry", horizonDays)
    .order("expiry_date", { ascending: true })
    .limit(200);
  return (data ?? []).map(normalizeLot);
}

export async function listRestockProducts(ctx: AppContext): Promise<ProductStockRow[]> {
  const { data } = await ctx.supabase
    .from("product_stock")
    .select("*")
    .eq("household_id", ctx.household.id)
    .eq("needs_restock", true)
    .order("total_quantity", { ascending: true })
    .order("name")
    .limit(200);
  return (data ?? []).map(normalizeProduct);
}

export async function getRatings(ctx: AppContext, productId: string, brandId: string | null) {
  const [product, brand] = await Promise.all([
    ctx.supabase
      .from("product_ratings")
      .select("user_id, rating, notes, updated_at, profile:profiles(display_name, email)")
      .eq("product_id", productId),
    brandId
      ? ctx.supabase
          .from("brand_ratings")
          .select("user_id, rating, notes, updated_at, profile:profiles(display_name, email)")
          .eq("brand_id", brandId)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  type R = {
    user_id: string;
    rating: number;
    notes: string | null;
    updated_at: string;
    profile: { display_name: string | null; email: string | null } | null;
  };

  type RawR = Omit<R, "profile"> & {
    profile: R["profile"] | NonNullable<R["profile"]>[];
  };

  const normalizeRatings = (rows: unknown[]): R[] =>
    (rows as RawR[]).map((row) => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile,
    }));

  return {
    product: normalizeRatings(product.data ?? []),
    brand: normalizeRatings(brand.data ?? []),
  };
}

/** Creates short-lived signed URLs for private item photos. */
export async function signImageUrls(ctx: AppContext, paths: Array<string | null>): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  const { data } = await ctx.supabase.storage.from("item-images").createSignedUrls(unique, 60 * 60);
  const out: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) out[entry.path] = entry.signedUrl;
  }
  return out;
}

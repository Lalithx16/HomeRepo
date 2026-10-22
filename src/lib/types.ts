/**
 * Typed row models for the database read models used by the app.
 * They mirror the SQL in supabase/migrations. If you change the schema, update
 * these types (or generate full types with `npm run db:types`).
 */
import type { ExpiryStatus } from "@/lib/domain/expiry";
import type { StockStatus } from "@/lib/domain/stock";

export type HouseholdRole = "owner" | "editor" | "viewer";
export type LocationKind = "room" | "storage" | "shelf" | "drawer" | "container" | "other";
export type TxnKind = "create" | "add" | "purchase" | "consume" | "discard" | "adjust" | "move";

export interface Household {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  expiry_warning_days: number;
  restock_multiplier: number;
}

export interface HouseholdMembership {
  role: HouseholdRole;
  household: Household;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  store_section: string | null;
  sort_order: number;
}

export interface LocationRow {
  id: string;
  household_id: string;
  parent_id: string | null;
  name: string;
  kind: LocationKind;
  notes: string | null;
  sort_order: number;
  lot_count: number;
  product_count: number;
}

export interface ProductStockRow {
  id: string;
  household_id: string;
  name: string;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  store_section: string | null;
  default_unit: string;
  ingredient_key: string | null;
  image_path: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  total_quantity: number;
  lot_count: number;
  all_lot_count: number;
  single_lot_id: string | null;
  single_lot_quantity: number | null;
  single_lot_unit: string | null;
  location_ids: string[];
  location_names: string | null;
  earliest_expiry: string | null;
  min_quantity: number | null;
  target_quantity: number | null;
  stock_status: StockStatus;
  needs_restock: boolean;
  expiry_status: ExpiryStatus;
}

export interface LotDetailRow {
  id: string;
  household_id: string;
  product_id: string;
  product_name: string;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  image_path: string | null;
  location_id: string;
  location_name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  purchase_date: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  days_until_expiry: number | null;
  expiry_status: ExpiryStatus;
}

export interface TransactionRow {
  id: string;
  product_id: string | null;
  lot_id: string | null;
  product_name: string;
  kind: TxnKind;
  quantity_delta: number;
  unit: string;
  quantity_after: number | null;
  from_location_id: string | null;
  to_location_id: string | null;
  total_price: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ShoppingItemRow {
  id: string;
  list_id: string;
  product_id: string | null;
  category_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
  source: "manual" | "low_stock" | "recipe";
  recipe_id: string | null;
  checked_at: string | null;
  removed_at: string | null;
  purchased_at: string | null;
  created_at: string;
  category: { name: string; store_section: string | null } | null;
  product: { default_unit: string; name: string } | null;
}

export interface RecipeRow {
  id: string;
  household_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  icon: string;
  cuisine: string | null;
  prep_minutes: number;
  cook_minutes: number;
  servings: number;
  difficulty: "easy" | "medium" | "hard";
  diets: string[];
  instructions: string[];
  recipe_ingredients: RecipeIngredientRow[];
}

export interface RecipeIngredientRow {
  id: string;
  position: number;
  ingredient_key: string;
  display_name: string;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
  note: string | null;
}

export interface MemberRow {
  user_id: string;
  role: HouseholdRole;
  created_at: string;
  profile: { email: string | null; display_name: string | null } | null;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: HouseholdRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface SearchResults {
  products: Array<{
    id: string;
    name: string;
    brand_name: string | null;
    category_name: string | null;
    total_quantity: number;
    default_unit: string;
    stock_status: StockStatus;
    expiry_status: ExpiryStatus;
    location_names: string | null;
  }>;
  locations: Array<{ id: string; name: string; kind: LocationKind; lot_count: number; path: string }>;
  categories: Array<{ id: string; name: string; icon: string; product_count: number }>;
}

export interface AnalyticsData {
  today: string;
  totals: { products: number; in_stock: number; out: number; low: number; needs_restock: number; with_rule: number };
  by_category: Array<{ label: string; value: number }>;
  by_location: Array<{ id: string; label: string; value: number }>;
  expiry_buckets: { expired: number; next_3: number; next_7: number; next_30: number; later: number; no_expiry: number };
  spending: { priced_purchases: number; by_month: Array<{ month: string; value: number }> };
  activity_30d: Array<{ kind: TxnKind; value: number }>;
  top_consumed_30d: Array<{ label: string; value: number }>;
}

/** Postgres numeric columns arrive as numbers or strings depending on size; normalize. */
export function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : num(value);
}

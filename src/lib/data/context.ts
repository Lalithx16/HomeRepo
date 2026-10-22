import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { todayInTimeZone } from "@/lib/domain/expiry";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { num, type Household, type HouseholdMembership, type HouseholdRole } from "@/lib/types";

export const HOUSEHOLD_COOKIE = "hb_household";

export interface AppContext {
  supabase: ServerSupabase;
  user: { id: string; email: string | null };
  displayName: string | null;
  household: Household;
  role: HouseholdRole;
  households: HouseholdMembership[];
  /** Today's date in the household time zone (YYYY-MM-DD). */
  today: string;
  canEdit: boolean;
}

type ContextResult =
  | { status: "ok"; ctx: AppContext }
  | { status: "unauthenticated" }
  | { status: "no-household"; supabase: ServerSupabase; user: { id: string; email: string | null } };

/**
 * Resolves the signed-in user and active household for this request.
 * The active household comes from a cookie but is ALWAYS validated against the
 * user's memberships (and RLS enforces membership again in the database).
 */
export const loadContext = cache(async (): Promise<ContextResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase
      .from("household_members")
      .select("role, household:households(id, name, timezone, currency, expiry_warning_days, restock_multiplier)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  const households: HouseholdMembership[] = (memberships ?? [])
    .filter((m: { household: unknown }) => m.household)
    .map((m: { role: HouseholdRole; household: Household }) => ({
      role: m.role,
      household: {
        ...m.household,
        expiry_warning_days: num(m.household.expiry_warning_days),
        restock_multiplier: num(m.household.restock_multiplier),
      },
    }));

  const sessionUser = { id: user.id, email: user.email ?? null };
  if (households.length === 0) return { status: "no-household", supabase, user: sessionUser };

  const cookieStore = await cookies();
  const preferred = cookieStore.get(HOUSEHOLD_COOKIE)?.value;
  const active = households.find((m) => m.household.id === preferred) ?? households[0]!;

  return {
    status: "ok",
    ctx: {
      supabase,
      user: sessionUser,
      displayName: (profile?.display_name as string | null | undefined) ?? null,
      household: active.household,
      role: active.role,
      households,
      today: todayInTimeZone(active.household.timezone),
      canEdit: active.role === "owner" || active.role === "editor",
    },
  };
});

/** For pages: redirects to /login or /onboarding when needed. */
export async function requireContext(): Promise<AppContext> {
  const result = await loadContext();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "no-household") redirect("/onboarding");
  return result.ctx;
}

import type { AppContext } from "./context";
import type { InvitationRow, MemberRow } from "@/lib/types";

export async function listMembers(ctx: AppContext): Promise<MemberRow[]> {
  const { data } = await ctx.supabase
    .from("household_members")
    .select("user_id, role, created_at, profile:profiles(email, display_name)")
    .eq("household_id", ctx.household.id)
    .order("created_at");
  return (data ?? []).map((row) => ({
    ...row,
    profile: Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile,
  })) as MemberRow[];
}

export async function listInvitations(ctx: AppContext): Promise<InvitationRow[]> {
  if (ctx.role !== "owner") return [];
  const { data } = await ctx.supabase
    .from("household_invitations")
    .select("id, email, role, expires_at, accepted_at, revoked_at, created_at")
    .eq("household_id", ctx.household.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []) as InvitationRow[];
}

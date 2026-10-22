"use server";

import { cookies } from "next/headers";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { HOUSEHOLD_COOKIE, loadContext } from "@/lib/data/context";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  createHouseholdSchema,
  householdSettingsSchema,
  inviteSchema,
  memberRoleSchema,
  uuid,
} from "@/lib/validation/schemas";
import { dbFail, editorContext, memberContext, ownerContext, revalidateApp, validationFail } from "./helpers";

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production" };

export async function createHouseholdAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const result = await loadContext();
  if (result.status === "unauthenticated") return fail("unauthenticated", "Your session has expired. Please sign in again.");
  const supabase = result.status === "ok" ? result.ctx.supabase : result.supabase;

  const parsed = createHouseholdSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { data, error } = await supabase.rpc("create_household", {
    p_name: v.name,
    p_timezone: v.timezone,
    p_currency: v.currency,
    p_seed_defaults: v.seedDefaults,
  });
  if (error) return dbFail(error);
  const cookieStore = await cookies();
  cookieStore.set(HOUSEHOLD_COOKIE, data as string, COOKIE_OPTIONS);
  revalidateApp();
  return ok({ id: data as string }, `${v.name} is ready`);
}

export async function switchHouseholdAction(householdId: string): Promise<ActionResult<null>> {
  const guarded = await memberContext();
  if (guarded.error) return guarded.error;
  if (!guarded.ctx.households.some((m) => m.household.id === householdId)) {
    return fail("forbidden", "You're not a member of that household.");
  }
  const cookieStore = await cookies();
  cookieStore.set(HOUSEHOLD_COOKIE, householdId, COOKIE_OPTIONS);
  revalidateApp();
  return ok(null);
}

export async function updateHouseholdAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await ownerContext();
  if (guarded.error) return guarded.error;
  const parsed = householdSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const v = parsed.data;
  const { error } = await guarded.ctx.supabase
    .from("households")
    .update({
      name: v.name,
      timezone: v.timezone,
      currency: v.currency,
      expiry_warning_days: v.expiryWarningDays,
      restock_multiplier: v.restockMultiplier,
    })
    .eq("id", guarded.ctx.household.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Household settings saved");
}

export async function deleteHouseholdAction(confirmName: string): Promise<ActionResult<null>> {
  const guarded = await ownerContext();
  if (guarded.error) return guarded.error;
  if (confirmName.trim() !== guarded.ctx.household.name) {
    return fail("validation", "Type the household name exactly to confirm.", { fieldErrors: { confirm: ["Name doesn't match"] } });
  }
  const { error } = await guarded.ctx.supabase.from("households").delete().eq("id", guarded.ctx.household.id);
  if (error) return dbFail(error);
  const cookieStore = await cookies();
  cookieStore.delete(HOUSEHOLD_COOKIE);
  revalidateApp();
  return ok(null, "Household deleted");
}

export async function inviteMemberAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const guarded = await ownerContext();
  if (guarded.error) return guarded.error;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await guarded.ctx.supabase.rpc("create_invitation", {
    p_household: guarded.ctx.household.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return dbFail(error);
  const { siteUrl } = getPublicEnv();
  revalidateApp();
  return ok({ url: `${siteUrl}/invite/${data as string}` }, "Invitation created");
}

export async function revokeInvitationAction(id: string): Promise<ActionResult<null>> {
  const guarded = await ownerContext();
  if (guarded.error) return guarded.error;
  if (!uuid.safeParse(id).success) return fail("validation", "Invalid invitation.");
  const { error } = await guarded.ctx.supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", guarded.ctx.household.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Invitation revoked");
}

export async function acceptInvitationAction(token: string): Promise<ActionResult<{ householdId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated", "Sign in to accept this invitation.");
  if (!/^[a-f0-9]{64}$/.test(token)) return fail("not_found", "This invitation link isn't valid.");
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return dbFail(error);
  const cookieStore = await cookies();
  cookieStore.set(HOUSEHOLD_COOKIE, data as string, COOKIE_OPTIONS);
  revalidateApp();
  return ok({ householdId: data as string }, "You've joined the household");
}

export async function updateMemberRoleAction(input: unknown): Promise<ActionResult<null>> {
  const guarded = await ownerContext();
  if (guarded.error) return guarded.error;
  const parsed = memberRoleSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await guarded.ctx.supabase
    .from("household_members")
    .update({ role: parsed.data.role })
    .eq("household_id", guarded.ctx.household.id)
    .eq("user_id", parsed.data.userId);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Role updated");
}

export async function removeMemberAction(userId: string): Promise<ActionResult<null>> {
  const guarded = await memberContext();
  if (guarded.error) return guarded.error;
  const { ctx } = guarded;
  if (!uuid.safeParse(userId).success) return fail("validation", "Invalid member.");
  if (userId !== ctx.user.id && ctx.role !== "owner") return fail("forbidden", "Only owners can remove members.");
  const { error } = await ctx.supabase
    .from("household_members")
    .delete()
    .eq("household_id", ctx.household.id)
    .eq("user_id", userId);
  if (error) return dbFail(error);
  if (userId === ctx.user.id) {
    const cookieStore = await cookies();
    cookieStore.delete(HOUSEHOLD_COOKIE);
  }
  revalidateApp();
  return ok(null, userId === ctx.user.id ? "You left the household" : "Member removed");
}

export async function loadSampleDataAction(): Promise<ActionResult<{ count: number }>> {
  const guarded = await editorContext();
  if (guarded.error) return guarded.error;
  const { data, error } = await guarded.ctx.supabase.rpc("seed_sample_data", { p_household: guarded.ctx.household.id });
  if (error) return dbFail(error);
  revalidateApp();
  const count = Number(data ?? 0);
  return ok({ count }, count === 0 ? "Sample items are already loaded" : `Added ${count} sample items`);
}

export async function updateProfileAction(displayName: string): Promise<ActionResult<null>> {
  const guarded = await memberContext();
  if (guarded.error) return guarded.error;
  const name = displayName.trim().slice(0, 80);
  const { error } = await guarded.ctx.supabase
    .from("profiles")
    .update({ display_name: name || null })
    .eq("id", guarded.ctx.user.id);
  if (error) return dbFail(error);
  revalidateApp();
  return ok(null, "Profile updated");
}

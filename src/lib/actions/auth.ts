"use server";

import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { validationFail } from "./helpers";

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function signInAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return fail("unauthenticated", "Please confirm your email first — check your inbox for the link.");
    }
    return fail("unauthenticated", "That email and password don't match. Try again or reset your password.");
  }
  redirect(safeNext((input as { next?: unknown })?.next));
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { siteUrl } = getPublicEnv();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
      data: { display_name: parsed.data.displayName ?? undefined },
    },
  });
  if (error) {
    return fail("validation", error.message.includes("registered") ? "An account with this email already exists." : "Could not create your account. Please try again.");
  }
  if (data.session) redirect("/onboarding");
  return ok({ needsConfirmation: true }, "Check your email to confirm your account.");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { siteUrl } = getPublicEnv();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists (no account enumeration).
  return ok(null, "If an account exists for that email, a reset link is on its way.");
}

export async function updatePasswordAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated", "Your reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("validation", "Could not update your password. Try a different one.");
  return ok(null, "Password updated");
}

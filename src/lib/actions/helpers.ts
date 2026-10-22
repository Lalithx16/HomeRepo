import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { loadContext, type AppContext } from "@/lib/data/context";
import { mapDbError, type DbErrorLike } from "@/lib/errors";
import { fieldErrorsOf } from "@/lib/validation/schemas";
import type { ZodError } from "zod";

type Guarded = { ctx: AppContext; error?: undefined } | { ctx?: undefined; error: ActionResult<never> };

/** Server-side authorization for actions. RLS enforces the same rules again in Postgres. */
export async function memberContext(): Promise<Guarded> {
  const result = await loadContext();
  if (result.status === "unauthenticated") {
    return { error: fail("unauthenticated", "Your session has expired. Please sign in again.") };
  }
  if (result.status === "no-household") return { error: fail("forbidden", "Create a household first.") };
  return { ctx: result.ctx };
}

export async function editorContext(): Promise<Guarded> {
  const guarded = await memberContext();
  if (guarded.error) return guarded;
  if (!guarded.ctx.canEdit) {
    return { error: fail("forbidden", "You have view-only access to this household. Ask an owner for edit access.") };
  }
  return guarded;
}

export async function ownerContext(): Promise<Guarded> {
  const guarded = await memberContext();
  if (guarded.error) return guarded;
  if (guarded.ctx.role !== "owner") return { error: fail("forbidden", "Only household owners can do that.") };
  return guarded;
}

export function dbFail(error: DbErrorLike | null | undefined, fallback?: string): ActionResult<never> {
  const mapped = mapDbError(error, fallback);
  if (mapped.code === "unknown" && error) {
    // Log server-side for debugging; the client only sees a friendly message.
    console.error("[homebase] database error", { code: error.code, message: error.message });
  }
  return fail(mapped.code, mapped.message);
}

export function validationFail(error: ZodError): ActionResult<never> {
  const fieldErrors = fieldErrorsOf(error);
  const first = Object.values(fieldErrors)[0]?.[0];
  return fail("validation", first ?? "Please check the highlighted fields.", { fieldErrors });
}

/** Refresh every server-rendered page (counts appear in many places). */
export function revalidateApp(): void {
  revalidatePath("/", "layout");
}

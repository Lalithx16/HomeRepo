import type { ActionErrorCode } from "./action-result";

export interface DbErrorLike {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

interface Mapped {
  code: ActionErrorCode;
  message: string;
}

const KNOWN: Record<string, Mapped> = {
  not_authenticated: { code: "unauthenticated", message: "Your session has expired. Please sign in again." },
  forbidden: { code: "forbidden", message: "You don't have permission to do that in this household." },
  not_found: { code: "not_found", message: "That item could not be found. It may have been deleted." },
  lot_not_found: { code: "conflict", message: "This batch no longer exists. It may have been removed on another device." },
  insufficient_quantity: { code: "conflict", message: "There isn't enough in stock for that change." },
  invalid_quantity: { code: "validation", message: "Enter a valid quantity." },
  version_conflict: { code: "conflict", message: "Someone else changed this just now. Reload to see the latest version." },
  incompatible_units: { code: "validation", message: "Those units can't be converted to each other." },
  location_cycle: { code: "validation", message: "A location can't be placed inside itself or one of its sub-locations." },
  location_too_deep: { code: "validation", message: "Locations can be nested at most 8 levels deep." },
  invalid_parent: { code: "validation", message: "Choose a parent location from this household." },
  invalid_reference: { code: "validation", message: "One of the selected options belongs to another household." },
  location_required: { code: "validation", message: "Choose where each purchased item will be stored." },
  last_owner: { code: "conflict", message: "A household needs at least one owner. Make someone else an owner first." },
  invitation_invalid: { code: "not_found", message: "This invitation link isn't valid." },
  invitation_used: { code: "conflict", message: "This invitation has already been used." },
  invitation_expired: { code: "conflict", message: "This invitation has expired. Ask for a new one." },
  invitation_email_mismatch: { code: "forbidden", message: "This invitation was sent to a different email address." },
  too_many_households: { code: "validation", message: "You can belong to at most 20 households." },
  invalid_role: { code: "validation", message: "Choose a valid role." },
};

/** Maps Postgres/PostgREST errors to safe, friendly messages (never leaks SQL). */
export function mapDbError(error: DbErrorLike | null | undefined, fallback = "Something went wrong. Please try again."): Mapped {
  if (!error) return { code: "unknown", message: fallback };
  const key = (error.message ?? "").trim();
  const known = KNOWN[key];
  if (known) {
    // Our functions put user-safe explanations in DETAIL.
    return { code: known.code, message: error.details && key !== "not_authenticated" ? error.details : known.message };
  }
  switch (error.code) {
    case "23505":
      return { code: "duplicate", message: "Something with that name already exists." };
    case "23503":
      return { code: "conflict", message: "This is still in use. Move or remove what's inside it first." };
    case "23514":
      return { code: "validation", message: "One of the values isn't allowed." };
    case "42501":
      return { code: "forbidden", message: "You don't have permission to do that in this household." };
    case "PGRST301":
    case "401":
      return { code: "unauthenticated", message: "Your session has expired. Please sign in again." };
    default:
      return { code: "unknown", message: fallback };
  }
}

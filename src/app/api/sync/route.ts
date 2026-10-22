import { NextResponse, type NextRequest } from "next/server";
import { loadContext } from "@/lib/data/context";
import { mapDbError } from "@/lib/errors";
import type { SyncResult } from "@/lib/offline/types";
import { syncRequestSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Applies queued offline changes. Each mutation carries a client-generated UUID
 * that the database stores as an idempotency key, so retries never double-apply.
 * Responds per mutation: applied | duplicate | conflict (needs user attention) | error (retryable).
 */
export async function POST(request: NextRequest) {
  const context = await loadContext();
  if (context.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (context.status === "no-household") {
    return NextResponse.json({ error: "no_household" }, { status: 403 });
  }
  const { ctx } = context;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const memberOf = new Set(ctx.households.filter((m) => m.role !== "viewer").map((m) => m.household.id));
  const results: SyncResult[] = [];

  for (const mutation of parsed.data.mutations) {
    if (!memberOf.has(mutation.householdId)) {
      results.push({ id: mutation.id, status: "conflict", message: "You no longer have edit access to this household." });
      continue;
    }
    const p = mutation.payload;
    try {
      if (p.type === "lot.adjust") {
        const signOk = p.kind === "add" ? p.delta > 0 : p.delta < 0;
        if (!signOk) {
          results.push({ id: mutation.id, status: "conflict", message: "Invalid change." });
          continue;
        }
        const { data, error } = await ctx.supabase.rpc("adjust_lot", {
          p_lot_id: p.lotId,
          p_delta: p.delta,
          p_kind: p.kind,
          p_note: null,
          p_client_mutation_id: mutation.id,
        });
        if (error) {
          const mapped = mapDbError(error);
          const retryable = mapped.code === "unknown";
          results.push({
            id: mutation.id,
            status: retryable ? "error" : "conflict",
            message: `${p.label}: ${mapped.message}`,
          });
        } else {
          results.push({ id: mutation.id, status: (data as { status: string }).status === "duplicate" ? "duplicate" : "applied" });
        }
      } else {
        const stamp = Number.isNaN(Date.parse(mutation.createdAt)) ? new Date().toISOString() : new Date(mutation.createdAt).toISOString();
        const { data, error } = await ctx.supabase
          .from("shopping_list_items")
          .update({ checked_at: p.checked ? stamp : null, checked_by: p.checked ? ctx.user.id : null })
          .eq("id", p.itemId)
          .eq("household_id", mutation.householdId)
          .is("purchased_at", null)
          .select("id");
        if (error) {
          const mapped = mapDbError(error);
          results.push({ id: mutation.id, status: mapped.code === "unknown" ? "error" : "conflict", message: mapped.message });
        } else if (!data || data.length === 0) {
          results.push({ id: mutation.id, status: "conflict", message: `${p.label} is no longer on the list.` });
        } else {
          results.push({ id: mutation.id, status: "applied" });
        }
      }
    } catch {
      results.push({ id: mutation.id, status: "error", message: "Temporary problem — will retry." });
    }
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

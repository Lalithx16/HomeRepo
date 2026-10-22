import { NextResponse, type NextRequest } from "next/server";
import { loadContext } from "@/lib/data/context";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await loadContext();
  if (context.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (context.status === "no-household") return NextResponse.json({ error: "no_household" }, { status: 403 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return NextResponse.json({ products: [], locations: [], categories: [] });

  const { data, error } = await context.ctx.supabase.rpc("search_household", {
    p_household: context.ctx.household.id,
    p_query: q,
    p_limit: 6,
  });
  if (error) return NextResponse.json({ error: "search_failed" }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

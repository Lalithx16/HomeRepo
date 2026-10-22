import { AppShell } from "@/components/layout/app-shell";
import { requireContext } from "@/lib/data/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const hid = ctx.household.id;

  const [expiring, restock, shopping] = await Promise.all([
    ctx.supabase
      .from("lot_details")
      .select("id", { count: "exact", head: true })
      .eq("household_id", hid)
      .in("expiry_status", ["expired", "expiring"]),
    ctx.supabase
      .from("product_stock")
      .select("id", { count: "exact", head: true })
      .eq("household_id", hid)
      .eq("needs_restock", true),
    ctx.supabase
      .from("shopping_list_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", hid)
      .is("removed_at", null)
      .is("purchased_at", null)
      .is("checked_at", null),
  ]);

  const current = ctx.households.find((m) => m.household.id === hid)!;

  return (
    <AppShell
      current={current}
      households={ctx.households}
      displayName={ctx.displayName}
      email={ctx.user.email}
      canEdit={ctx.canEdit}
      badges={{ expiring: expiring.count ?? 0, restock: restock.count ?? 0, shopping: shopping.count ?? 0 }}
    >
      {children}
    </AppShell>
  );
}

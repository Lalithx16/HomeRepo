import type { AppContext } from "./context";
import { num, type AnalyticsData } from "@/lib/types";

export async function getAnalytics(ctx: AppContext): Promise<AnalyticsData | null> {
  const { data, error } = await ctx.supabase.rpc("household_analytics", { p_household: ctx.household.id });
  if (error || !data) return null;
  const d = data as AnalyticsData;
  return {
    ...d,
    spending: {
      priced_purchases: num(d.spending?.priced_purchases),
      by_month: (d.spending?.by_month ?? []).map((m) => ({ month: m.month, value: num(m.value) })),
    },
  };
}

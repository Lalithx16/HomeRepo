import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateHouseholdForm } from "@/components/onboarding/create-household-form";
import { Logo } from "@/components/shared/logo";
import { loadContext } from "@/lib/data/context";

export const metadata = { title: "Set up your household" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [ctx, params] = await Promise.all([loadContext(), searchParams]);
  if (ctx.status === "unauthenticated") redirect("/login");
  const hasHousehold = ctx.status === "ok";
  if (hasHousehold && params.new !== "1") redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 pt-safe">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{hasHousehold ? "Create another household" : "Set up your household"}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            A household holds your inventory, locations and shopping list. You can invite family members later.
          </p>
          <CreateHouseholdForm />
        </div>
        {hasHousehold ? (
          <p className="mt-6 text-center text-sm">
            <Link href="/" className="font-medium text-primary hover:underline">
              Cancel
            </Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Were you invited? Open the invitation link from your email instead.
          </p>
        )}
      </div>
    </main>
  );
}

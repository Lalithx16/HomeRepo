import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvite } from "./accept-invite";

export const metadata = { title: "Join household" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">You&apos;re invited</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Someone invited you to share their Homebase household. Accepting gives you access to its inventory, locations
            and shopping list.
          </p>
          {user ? (
            <AcceptInvite token={token} email={user.email ?? ""} />
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild size="lg">
                <Link href={`/login?next=${next}`}>Sign in to accept</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={`/signup`}>Create an account</Link>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Use the same email address the invitation was sent to. After creating an account, open this link again.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

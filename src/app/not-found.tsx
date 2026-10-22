import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-8" />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        This page doesn&apos;t exist, or the item was removed.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to overview</Link>
      </Button>
    </main>
  );
}

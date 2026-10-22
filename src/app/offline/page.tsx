import { CloudOff } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { RetryButton } from "./retry-button";

export const dynamic = "force-static";
export const metadata = { title: "Offline" };

/** Pre-cached by the service worker and shown for pages that were never visited online. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <CloudOff className="size-5" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page hasn&apos;t been saved on this device yet. Pages you&apos;ve opened before are available offline, and
        quantity changes you make there will sync when you reconnect.
      </p>
      <RetryButton />
    </main>
  );
}

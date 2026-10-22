"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <EmptyState
      icon={AlertTriangle}
      title={offline ? "You're offline" : "Something went wrong"}
      description={
        offline
          ? "This page hasn't been saved for offline use yet. Reconnect and try again."
          : "We couldn't load this page. Your data is safe — try again in a moment."
      }
      action={
        <Button onClick={reset} variant="secondary">
          <RotateCcw /> Try again
        </Button>
      }
    />
  );
}

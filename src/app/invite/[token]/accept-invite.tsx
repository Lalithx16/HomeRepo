"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { acceptInvitationAction } from "@/lib/actions/household";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message ?? "Joined");
      router.push("/");
      router.refresh();
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2.5 text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button size="lg" onClick={accept} loading={pending}>
        Accept invitation
      </Button>
      <p className="text-xs text-muted-foreground">Signed in as {email}</p>
    </div>
  );
}

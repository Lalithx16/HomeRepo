"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { loadSampleDataAction } from "@/lib/actions/household";
import { Button } from "@/components/ui/button";

/** Explicitly optional demo data — never loaded automatically. */
export function LoadSampleButton({ variant = "secondary" }: { variant?: "secondary" | "ghost" }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant={variant}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await loadSampleDataAction();
          if (!result.ok) toast.error(result.error);
          else {
            toast.success(result.message ?? "Sample items added");
            router.refresh();
          }
        })
      }
    >
      {pending ? null : <Sparkles />} Load sample kitchen
    </Button>
  );
}

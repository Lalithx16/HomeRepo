"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button className="mt-6" variant="secondary" onClick={() => window.location.reload()}>
      <RotateCcw /> Try again
    </Button>
  );
}

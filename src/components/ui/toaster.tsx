"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      closeButton
      offset={16}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-surface !text-foreground !shadow-raised !font-sans",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md",
        },
      }}
    />
  );
}

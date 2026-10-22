import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex size-12 items-center justify-center rounded-full",
          tone === "success" ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

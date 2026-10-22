import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail?: string;
  icon: LucideIcon;
  href: string;
  tone?: "neutral" | "warning" | "critical" | "primary";
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tone === "neutral" && "bg-surface-muted text-muted-foreground",
            tone === "primary" && "bg-primary-soft text-primary-soft-foreground",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "critical" && "bg-critical-soft text-critical",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="tabular mt-3 text-[28px] leading-none font-semibold tracking-tight">{value}</div>
      {detail ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{detail}</p> : null}
    </Link>
  );
}

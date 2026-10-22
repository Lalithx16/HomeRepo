import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  href?: string;
  tone?: "primary" | "warning" | "critical" | "neutral" | "info";
}

/**
 * Accessible horizontal bar chart: a real list with text values, so screen
 * readers and color-blind users get the same information as the bars.
 */
export function BarList({
  data,
  format = (v) => String(v),
  emptyText = "No data yet.",
  label,
}: {
  data: BarDatum[];
  format?: (value: number) => string;
  emptyText?: string;
  label: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="flex flex-col gap-2.5" aria-label={label}>
      {data.map((d) => {
        const width = `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`;
        const content = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{d.label}</span>
              <span className="tabular shrink-0 font-medium">{format(d.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full",
                  (!d.tone || d.tone === "primary") && "bg-primary",
                  d.tone === "warning" && "bg-warning",
                  d.tone === "critical" && "bg-critical",
                  d.tone === "info" && "bg-info",
                  d.tone === "neutral" && "bg-border-strong",
                )}
                style={{ width }}
              />
            </div>
          </>
        );
        return (
          <li key={d.label}>
            {d.href ? (
              <Link href={d.href} className="block rounded-md hover:opacity-80">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

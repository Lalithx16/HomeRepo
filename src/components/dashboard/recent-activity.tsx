import { ArrowRightLeft, History, Minus, PackagePlus, PencilLine, Plus, ShoppingBag, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/domain/format";
import { describeTransaction, type TransactionKind } from "@/lib/domain/transactions";
import type { TransactionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<TransactionKind, LucideIcon> = {
  create: PackagePlus,
  add: Plus,
  purchase: ShoppingBag,
  consume: Minus,
  discard: Trash2,
  adjust: PencilLine,
  move: ArrowRightLeft,
};

export function TransactionList({
  transactions,
  locationNames,
  showProduct = true,
  emptyText = "No changes yet.",
}: {
  transactions: TransactionRow[];
  locationNames: Record<string, string>;
  showProduct?: boolean;
  emptyText?: string;
}) {
  if (transactions.length === 0) {
    return (
      <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden /> {emptyText}
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border">
      {transactions.map((t) => {
        const Icon = ICONS[t.kind];
        const text = describeTransaction(t, (id) => (id ? locationNames[id] ?? null : null));
        const body = (
          <>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                t.kind === "consume" || t.kind === "discard" ? "bg-surface-muted text-muted-foreground" : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              {showProduct ? <p className="truncate text-sm font-medium">{t.product_name}</p> : null}
              <p className={cn("truncate", showProduct ? "text-xs text-muted-foreground" : "text-sm")}>
                {text}
                {t.note ? <span className="text-muted-foreground"> · {t.note}</span> : null}
              </p>
            </div>
            <time dateTime={t.created_at} className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(t.created_at)}
            </time>
          </>
        );
        return (
          <li key={t.id}>
            {showProduct && t.product_id ? (
              <Link href={`/inventory/${t.product_id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 sm:px-5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

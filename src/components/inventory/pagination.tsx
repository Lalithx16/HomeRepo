import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-sm text-muted-foreground tabular">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "secondary" })} rel="prev">
            <ChevronLeft /> Previous
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "secondary" }), "pointer-events-none opacity-50")} aria-disabled>
            <ChevronLeft /> Previous
          </span>
        )}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "secondary" })} rel="next">
            Next <ChevronRight />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "secondary" }), "pointer-events-none opacity-50")} aria-disabled>
            Next <ChevronRight />
          </span>
        )}
      </div>
    </nav>
  );
}

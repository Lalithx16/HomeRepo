import { AlertTriangle, CalendarClock, CheckCircle2, CircleSlash, Clock, PackageMinus } from "lucide-react";
import { describeExpiry, type ExpiryStatus } from "@/lib/domain/expiry";
import type { StockStatus } from "@/lib/domain/stock";
import { Badge } from "@/components/ui/badge";

/** Stock badge: icon + text (never color alone). Hidden for normal stock unless `showOk`. */
export function StockBadge({ status, showOk = false }: { status: StockStatus; showOk?: boolean }) {
  if (status === "out")
    return (
      <Badge tone="critical">
        <CircleSlash aria-hidden />
        Out of stock
      </Badge>
    );
  if (status === "low")
    return (
      <Badge tone="warning">
        <PackageMinus aria-hidden />
        Low stock
      </Badge>
    );
  if (!showOk) return null;
  return (
    <Badge tone="success">
      <CheckCircle2 aria-hidden />
      In stock
    </Badge>
  );
}

export function ExpiryBadge({
  status,
  date,
  today,
  showFresh = false,
}: {
  status: ExpiryStatus;
  date: string | null;
  today: string;
  showFresh?: boolean;
}) {
  if (status === "expired")
    return (
      <Badge tone="critical">
        <AlertTriangle aria-hidden />
        {describeExpiry(date, today)}
      </Badge>
    );
  if (status === "expiring")
    return (
      <Badge tone="warning">
        <Clock aria-hidden />
        {describeExpiry(date, today)}
      </Badge>
    );
  if (status === "fresh" && showFresh)
    return (
      <Badge tone="neutral">
        <CalendarClock aria-hidden />
        {describeExpiry(date, today)}
      </Badge>
    );
  return null;
}

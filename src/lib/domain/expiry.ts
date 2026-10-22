/**
 * Expiry classification. Dates are calendar dates ("YYYY-MM-DD") without a
 * time component; all arithmetic is done in UTC to avoid DST/time-zone drift.
 * Items without an expiry date are never treated as expired or expiring.
 */
export type ExpiryStatus = "none" | "expired" | "expiring" | "fresh";

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtcDay(date: string): number {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

/** Whole days from `today` to `date` (negative when in the past). */
export function daysBetween(today: string, date: string): number {
  return Math.round(toUtcDay(date) - toUtcDay(today));
}

export function addDays(date: string, days: number): string {
  return new Date((toUtcDay(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Today's calendar date in the given IANA time zone, e.g. "Asia/Kolkata". */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function classifyExpiry(
  expiryDate: string | null | undefined,
  today: string,
  warningDays: number,
  quantity = 1,
): ExpiryStatus {
  if (!expiryDate || quantity <= 0) return "none";
  const days = daysBetween(today, expiryDate);
  if (days < 0) return "expired";
  if (days <= warningDays) return "expiring";
  return "fresh";
}

export function describeExpiry(expiryDate: string | null | undefined, today: string): string {
  if (!expiryDate) return "No expiry date";
  const days = daysBetween(today, expiryDate);
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return "Expired yesterday";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days < 14) return `Expires in ${days} days`;
  if (days < 60) return `Expires in ${Math.round(days / 7)} weeks`;
  return `Expires ${formatDate(expiryDate)}`;
}

export function formatDate(date: string): string {
  if (!isIsoDate(date)) return date;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Sort key: expired first, then soonest; no-expiry last. */
export function compareExpiry(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

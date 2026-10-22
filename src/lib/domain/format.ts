export function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((then - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604_800) return rtf.format(Math.round(seconds / 86_400), "day");
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Escapes LIKE/ILIKE wildcards in user search input. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

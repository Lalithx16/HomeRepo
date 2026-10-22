import { describe, expect, it } from "vitest";
import { escapeLike, formatCurrency, formatMonth, formatRelativeTime, greeting, pluralize } from "@/lib/domain/format";
import { describeTransaction } from "@/lib/domain/transactions";

describe("transaction descriptions", () => {
  const base = { quantity_delta: -2, unit: "pcs", to_location_id: null, from_location_id: null };
  it("describes each kind in plain language", () => {
    expect(describeTransaction({ ...base, kind: "consume" })).toBe("Used 2 pieces");
    expect(describeTransaction({ ...base, kind: "discard" })).toBe("Discarded 2 pieces");
    expect(describeTransaction({ ...base, kind: "adjust", quantity_delta: -0.25, unit: "kg" })).toBe("Count decreased by 0.25 kg");
    expect(describeTransaction({ ...base, kind: "purchase", quantity_delta: 1, unit: "loaf" })).toBe("Bought 1 loaf");
    expect(describeTransaction({ ...base, kind: "move", quantity_delta: 1, to_location_id: "x" }, () => "Pantry")).toBe("Moved 1 piece to Pantry");
  });
});

describe("formatting helpers", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
  it("formats currency and months", () => {
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
    expect(formatMonth("2026-10")).toBe("Oct 26");
  });
  it("formats relative times", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(formatRelativeTime("2026-10-21T11:59:50Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-21T10:00:00Z", now)).toBe("2 hours ago");
    expect(formatRelativeTime("2026-10-20T12:00:00Z", now)).toBe("yesterday");
  });
  it("greets by time of day and pluralizes", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
    expect(pluralize(1, "item")).toBe("1 item");
    expect(pluralize(3, "batch", "batches")).toBe("3 batches");
  });
});

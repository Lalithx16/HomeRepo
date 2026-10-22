import { describe, expect, it } from "vitest";
import {
  addDays,
  classifyExpiry,
  compareExpiry,
  daysBetween,
  describeExpiry,
  isIsoDate,
  isValidTimeZone,
  todayInTimeZone,
} from "@/lib/domain/expiry";

const today = "2026-10-21";

describe("expiry classification", () => {
  it("never treats items without a date as expired or expiring", () => {
    expect(classifyExpiry(null, today, 7)).toBe("none");
    expect(classifyExpiry(undefined, today, 7)).toBe("none");
  });

  it("classifies expired, today, soon and fresh", () => {
    expect(classifyExpiry("2026-10-20", today, 7)).toBe("expired");
    expect(classifyExpiry("2026-10-21", today, 7)).toBe("expiring");
    expect(classifyExpiry("2026-10-28", today, 7)).toBe("expiring");
    expect(classifyExpiry("2026-10-29", today, 7)).toBe("fresh");
  });

  it("respects a zero-day warning window", () => {
    expect(classifyExpiry("2026-10-21", today, 0)).toBe("expiring");
    expect(classifyExpiry("2026-10-22", today, 0)).toBe("fresh");
  });

  it("ignores empty batches", () => {
    expect(classifyExpiry("2026-10-01", today, 7, 0)).toBe("none");
  });

  it("does calendar math across month/year and DST boundaries", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
  });

  it("describes expiry in plain language", () => {
    expect(describeExpiry(null, today)).toBe("No expiry date");
    expect(describeExpiry("2026-10-21", today)).toBe("Expires today");
    expect(describeExpiry("2026-10-22", today)).toBe("Expires tomorrow");
    expect(describeExpiry("2026-10-20", today)).toBe("Expired yesterday");
    expect(describeExpiry("2026-10-16", today)).toBe("Expired 5 days ago");
    expect(describeExpiry("2026-10-26", today)).toBe("Expires in 5 days");
  });

  it("uses the household time zone for 'today'", () => {
    const instant = new Date("2026-10-21T20:00:00Z");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-21");
    expect(todayInTimeZone("Asia/Kolkata", instant)).toBe("2026-10-22");
    expect(todayInTimeZone("America/Los_Angeles", instant)).toBe("2026-10-21");
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });

  it("sorts soonest first and no-expiry last", () => {
    const dates = ["2026-12-01", null, "2026-10-01", "2026-11-01"];
    expect([...dates].sort(compareExpiry)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01", null]);
  });
});

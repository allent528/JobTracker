import { describe, expect, it } from "vitest";

import { dateInTimeZone, daysBetween, formatDate, formatDateTime } from "./dates";

describe("formatDate", () => {
  it("formats a date-only value without shifting the day", () => {
    expect(formatDate("2026-11-14")).toBe("Nov 14, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });
});

describe("formatDateTime", () => {
  it("formats an instant in the given time zone", () => {
    const instant = "2026-11-15T03:30:00Z";
    expect(formatDateTime(instant, "UTC")).toBe("Nov 15, 2026, 3:30 AM");
    expect(formatDateTime(instant, "America/New_York")).toBe("Nov 14, 2026, 10:30 PM");
  });
});

describe("dateInTimeZone", () => {
  it("gives the calendar date in the owner's zone, not the server's", () => {
    const instant = "2026-11-15T03:30:00Z";
    expect(dateInTimeZone(instant, "UTC")).toBe("2026-11-15");
    expect(dateInTimeZone(instant, "America/New_York")).toBe("2026-11-14");
    expect(dateInTimeZone(new Date("2026-11-14T23:30:00Z"), "Asia/Tokyo")).toBe("2026-11-15");
  });

  it("handles a DST change (US clocks fall back on 2026-11-01)", () => {
    expect(dateInTimeZone("2026-11-01T04:30:00Z", "America/New_York")).toBe("2026-11-01");
    expect(dateInTimeZone("2026-11-02T04:30:00Z", "America/New_York")).toBe("2026-11-01");
  });
});

describe("daysBetween", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-11-14", "2026-11-14")).toBe(0);
    expect(daysBetween("2026-11-13", "2026-11-14")).toBe(1);
    expect(daysBetween("2026-10-31", "2026-11-14")).toBe(14);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-11-14", "2026-11-10")).toBe(-4);
  });

  it("isn't thrown off by DST or leap days", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./dates";

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

import { describe, expect, it } from "vitest";

import {
  addDays,
  dateInTimeZone,
  daysBetween,
  formatDate,
  formatDateTime,
  formatDateTimeWithZone,
  instantToLocalDateTime,
  localDateTimeToInstant,
  startOfDayInstant,
} from "./dates";

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

describe("localDateTimeToInstant / instantToLocalDateTime", () => {
  const roundTrip = (local: string, zone: string) => instantToLocalDateTime(localDateTimeToInstant(local, zone), zone);

  it("reads a wall-clock time in the given zone", () => {
    expect(localDateTimeToInstant("2026-12-01T10:00", "America/New_York").toISOString()).toBe("2026-12-01T15:00:00.000Z");
    expect(localDateTimeToInstant("2026-07-01T10:00", "America/New_York").toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(localDateTimeToInstant("2026-12-01T10:00", "UTC").toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(localDateTimeToInstant("2026-12-01T09:30", "Asia/Kolkata").toISOString()).toBe("2026-12-01T04:00:00.000Z");
    expect(localDateTimeToInstant("2027-01-01T00:15", "Pacific/Auckland").toISOString()).toBe("2026-12-31T11:15:00.000Z");
  });

  it("round-trips across zones and around midnight", () => {
    for (const zone of ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo", "Australia/Adelaide"]) {
      for (const local of ["2026-03-08T00:00", "2026-11-01T23:59", "2026-06-15T12:30", "2028-02-29T07:45"]) {
        expect(roundTrip(local, zone)).toBe(local);
      }
    }
  });

  it("handles the US DST changes", () => {
    // 2026-03-08 02:30 doesn't exist in New York; it becomes 03:30 EDT.
    expect(localDateTimeToInstant("2026-03-08T02:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(localDateTimeToInstant("2026-03-08T03:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    // 2026-11-01 01:30 happens twice; the first (EDT) wins.
    expect(localDateTimeToInstant("2026-11-01T01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(localDateTimeToInstant("2026-11-01T02:30", "America/New_York").toISOString()).toBe("2026-11-01T07:30:00.000Z");
  });

  it("shows an instant on the zone's wall clock", () => {
    expect(instantToLocalDateTime("2026-12-01T15:00:00Z", "America/New_York")).toBe("2026-12-01T10:00");
    expect(instantToLocalDateTime("2026-12-01T00:05:00Z", "America/Los_Angeles")).toBe("2026-11-30T16:05");
  });
});

describe("formatDateTimeWithZone", () => {
  it("appends the zone's short name", () => {
    expect(formatDateTimeWithZone("2026-12-01T15:00:00Z", "America/New_York")).toBe("Dec 1, 2026, 10:00 AM EST");
    expect(formatDateTimeWithZone("2026-07-01T14:00:00Z", "America/New_York")).toBe("Jul 1, 2026, 10:00 AM EDT");
    expect(formatDateTimeWithZone("2026-12-01T15:00:00Z", "UTC")).toBe("Dec 1, 2026, 3:00 PM UTC");
  });
});

describe("startOfDayInstant", () => {
  it("is midnight in the zone", () => {
    expect(startOfDayInstant("2026-12-01", "America/New_York").toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(startOfDayInstant("2026-12-01", "UTC").toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(startOfDayInstant("2026-12-01", "Asia/Tokyo").toISOString()).toBe("2026-11-30T15:00:00.000Z");
  });

  it("is the first instant of the day when DST skips midnight", () => {
    // Chile springs forward at 00:00 on Sep 6, 2026, so that day starts at 01:00 (UTC-3).
    expect(startOfDayInstant("2026-09-06", "America/Santiago").toISOString()).toBe("2026-09-06T04:00:00.000Z");
  });

  it("round-trips years 1900 to 2999", () => {
    for (const local of ["1900-01-01T00:00", "1969-12-31T23:59", "2999-12-31T23:59"]) {
      expect(instantToLocalDateTime(localDateTimeToInstant(local, "America/New_York"), "America/New_York")).toBe(local);
    }
  });
});

describe("addDays", () => {
  it("adds calendar days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-11-15", 7)).toBe("2026-11-22");
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by DST changes (date-only arithmetic)", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
  });
});

import { describe, expect, it } from "vitest";

import { dateInTimeZone } from "./dates";
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUSES } from "./status";
import {
  formatDays,
  parseIncludeArchived,
  statsPath,
  statsWindow,
  toResponseRate,
  toStageDurations,
  toStatusCounts,
  toWeekCounts,
} from "./stats";

describe("statsWindow", () => {
  it("covers 12 Monday-start weeks ending with the week that holds today, half-open", () => {
    // 2026-11-17 is a Tuesday.
    const window = statsWindow("2026-11-17");
    expect(window.weekStarts).toHaveLength(12);
    expect(window.weekStarts[11]).toBe("2026-11-16");
    expect(window.weekStarts[0]).toBe("2026-08-31");
    expect(window.fromDay).toBe("2026-08-31");
    expect(window.untilDay).toBe("2026-11-23");
  });

  it("treats Sunday as the last day of its week and Monday as the first of the next", () => {
    expect(statsWindow("2026-11-22").weekStarts[11]).toBe("2026-11-16");
    expect(statsWindow("2026-11-23").weekStarts[11]).toBe("2026-11-23");
  });

  it("crosses a year boundary", () => {
    const window = statsWindow("2027-01-02");
    expect(window.weekStarts[11]).toBe("2026-12-28");
    expect(window.weekStarts[0]).toBe("2026-10-12");
    expect(window.untilDay).toBe("2027-01-04");
  });

  it("follows the owner's zone: the same instant can fall in different weeks", () => {
    // Monday 2026-11-23 05:00 UTC is still Sunday in Pago Pago (UTC-11) but Monday evening in
    // Kiritimati (UTC+14).
    const instant = "2026-11-23T05:00:00Z";
    const pagoPago = statsWindow(dateInTimeZone(instant, "Pacific/Pago_Pago"));
    const kiritimati = statsWindow(dateInTimeZone(instant, "Pacific/Kiritimati"));
    expect(pagoPago.weekStarts[11]).toBe("2026-11-16");
    expect(kiritimati.weekStarts[11]).toBe("2026-11-23");
  });
});

describe("toWeekCounts", () => {
  const { weekStarts } = statsWindow("2026-11-17");

  it("sums days into their week and fills empty weeks with 0", () => {
    const weeks = toWeekCounts(
      [
        { day: "2026-11-16", applications: 2 }, // Monday, current week
        { day: "2026-11-22", applications: 1 }, // Sunday, current week
        { day: "2026-11-15", applications: 3 }, // Sunday, previous week
        { day: "2026-08-31", applications: 4 }, // first day of the window
      ],
      weekStarts,
    );
    expect(weeks).toHaveLength(12);
    expect(weeks[11]).toEqual({ weekStart: "2026-11-16", applications: 3 });
    expect(weeks[10]).toEqual({ weekStart: "2026-11-09", applications: 3 });
    expect(weeks[0]).toEqual({ weekStart: "2026-08-31", applications: 4 });
    expect(weeks.slice(1, 10).every((w) => w.applications === 0)).toBe(true);
  });

  it("ignores days outside the window", () => {
    const weeks = toWeekCounts(
      [
        { day: "2026-08-30", applications: 5 },
        { day: "2026-11-23", applications: 5 },
      ],
      weekStarts,
    );
    expect(weeks.reduce((sum, w) => sum + w.applications, 0)).toBe(0);
  });
});

describe("toStatusCounts", () => {
  it("lists every status in lifecycle order with zeros, split by kind, with a total", () => {
    const counts = toStatusCounts([
      { status: "rejected", applications: 2 },
      { status: "applied", applications: 3 },
    ]);
    expect(counts.active.map((c) => c.status)).toEqual([...ACTIVE_STATUSES]);
    expect(counts.closed.map((c) => c.status)).toEqual([...CLOSED_STATUSES]);
    expect(counts.active.find((c) => c.status === "applied")?.applications).toBe(3);
    expect(counts.active.find((c) => c.status === "saved")?.applications).toBe(0);
    expect(counts.closed.find((c) => c.status === "rejected")?.applications).toBe(2);
    expect(counts.total).toBe(5);
  });

  it("is all zeros with no rows", () => {
    expect(toStatusCounts([]).total).toBe(0);
  });
});

describe("toResponseRate", () => {
  it("rounds to a whole percent", () => {
    expect(toResponseRate({ reached: 3, responded: 1 })).toEqual({ reached: 3, responded: 1, percent: 33 });
    expect(toResponseRate({ reached: 3, responded: 2 }).percent).toBe(67);
  });

  it("has no percent when nothing reached applied", () => {
    expect(toResponseRate({ reached: 0, responded: 0 }).percent).toBeNull();
    expect(toResponseRate(undefined)).toEqual({ reached: 0, responded: 0, percent: null });
  });
});

describe("toStageDurations", () => {
  it("lists every status in lifecycle order, null where no stay has ended", () => {
    const durations = toStageDurations([
      { status: "screening", stays: 2, average_days: 4.25 },
      { status: "applied", stays: 3, average_days: 10 },
    ]);
    expect(durations.map((d) => d.status)).toEqual([...STATUSES]);
    expect(durations.find((d) => d.status === "applied")).toEqual({ status: "applied", stays: 3, averageDays: 10 });
    expect(durations.find((d) => d.status === "saved")).toEqual({ status: "saved", stays: 0, averageDays: null });
  });
});

describe("formatDays", () => {
  it.each([
    [4.25, "4.3 days"],
    [1, "1 day"],
    [0.96, "1 day"],
    [0.3, "0.3 days"],
    [0, "0 days"],
    [12, "12 days"],
  ])("%s → %s", (days, text) => {
    expect(formatDays(days)).toBe(text);
  });
});

describe("include archived param", () => {
  it("is on only for ?archived=1", () => {
    expect(parseIncludeArchived("1")).toBe(true);
    expect(parseIncludeArchived(undefined)).toBe(false);
    expect(parseIncludeArchived("true")).toBe(false);
    expect(parseIncludeArchived(["1", "1"])).toBe(false);
  });

  it("builds the stats path", () => {
    expect(statsPath(true)).toBe("/stats?archived=1");
    expect(statsPath(false)).toBe("/stats");
  });
});

import { describe, expect, it } from "vitest";

import type { UpcomingInterview } from "./interview-query";
import { bucketReminders, type DueFollowUp, formatDueIn, type ReminderBuckets, reminderWindow } from "./reminders";

function followUp(id: string, next_follow_up_on: string, company = "Acme Corp"): DueFollowUp {
  return { id, company, role_title: "Software Engineer", status: "applied", next_follow_up_on, follow_up_note: null };
}

function interview(id: string, scheduled_at: string): UpcomingInterview {
  return {
    id,
    kind: "technical",
    scheduled_at,
    duration_minutes: 60,
    location: null,
    application: { id: "app", company: "Acme Corp", role_title: "Software Engineer", status: "interviewing" },
  };
}

function keys(buckets: ReminderBuckets) {
  return {
    overdue: buckets.overdue.map((r) => r.key),
    today: buckets.today.map((r) => r.key),
    next7Days: buckets.next7Days.map((r) => r.key),
  };
}

describe("reminderWindow", () => {
  it("covers tomorrow through today + 7, with interviews loaded up to the start of day 8", () => {
    expect(reminderWindow("2026-11-15")).toEqual({ lastDay: "2026-11-22", untilDay: "2026-11-23" });
    expect(reminderWindow("2026-12-28")).toEqual({ lastDay: "2027-01-04", untilDay: "2027-01-05" });
    expect(reminderWindow("2028-02-25")).toEqual({ lastDay: "2028-03-03", untilDay: "2028-03-04" });
  });
});

describe("bucketReminders", () => {
  const today = "2026-11-15";

  it("puts follow-ups in Overdue, Today and Next 7 days, with day 7 in and day 8 out", () => {
    const buckets = bucketReminders({
      followUps: [
        followUp("long-ago", "2025-01-01"),
        followUp("yesterday", "2026-11-14"),
        followUp("today", "2026-11-15"),
        followUp("tomorrow", "2026-11-16"),
        followUp("day7", "2026-11-22"),
        followUp("day8", "2026-11-23"),
      ],
      interviews: [],
      today,
      timeZone: "UTC",
    });
    expect(keys(buckets)).toEqual({
      overdue: ["follow_up:long-ago", "follow_up:yesterday"],
      today: ["follow_up:today"],
      next7Days: ["follow_up:tomorrow", "follow_up:day7"],
    });
  });

  it("splits interviews at midnight in the owner's zone, not UTC", () => {
    const interviews = [
      interview("last-second-yesterday", "2026-11-15T04:59:59Z"), // 23:59:59 Nov 14 in New York (EST)
      interview("midnight", "2026-11-15T05:00:00Z"), // 00:00 Nov 15 in New York
      interview("late-today", "2026-11-16T04:59:00Z"), // 23:59 Nov 15 in New York
      interview("end-of-day7", "2026-11-23T04:59:00Z"), // 23:59 Nov 22
      interview("start-of-day8", "2026-11-23T05:00:00Z"), // 00:00 Nov 23
    ];
    expect(keys(bucketReminders({ followUps: [], interviews, today, timeZone: "America/New_York" }))).toEqual({
      overdue: ["interview:last-second-yesterday"],
      today: ["interview:midnight", "interview:late-today"],
      next7Days: ["interview:end-of-day7"],
    });
    // The same instants in UTC fall a day later around midnight.
    expect(keys(bucketReminders({ followUps: [], interviews, today, timeZone: "UTC" }))).toEqual({
      overdue: [],
      today: ["interview:last-second-yesterday", "interview:midnight"],
      next7Days: ["interview:late-today"], // Nov 23 04:59 UTC is day 8 in UTC
    });
  });

  it("uses the zone's offset on each day across a DST change", () => {
    // US clocks fall back on Sunday Nov 1, 2026: EDT (UTC-4) before, EST (UTC-5) after.
    const interviews = [
      interview("before-change", "2026-11-01T03:59:00Z"), // 23:59 Oct 31 EDT
      interview("after-change", "2026-11-01T04:00:00Z"), // 00:00 Nov 1 EDT
      interview("late-nov1", "2026-11-02T04:59:00Z"), // 23:59 Nov 1 EST
      interview("nov2", "2026-11-02T05:00:00Z"), // 00:00 Nov 2 EST
    ];
    expect(
      keys(bucketReminders({ followUps: [], interviews, today: "2026-11-01", timeZone: "America/New_York" })),
    ).toEqual({
      overdue: ["interview:before-change"],
      today: ["interview:after-change", "interview:late-nov1"],
      next7Days: ["interview:nov2"],
    });
  });

  it("handles zones far ahead of UTC and the date line", () => {
    // 11:30 UTC on Nov 14 is 00:30 Nov 15 in Auckland (NZDT, UTC+13) and 01:30 Nov 15 in Kiritimati (UTC+14).
    const interviews = [interview("i", "2026-11-14T11:30:00Z")];
    for (const timeZone of ["Pacific/Auckland", "Pacific/Kiritimati"]) {
      expect(keys(bucketReminders({ followUps: [], interviews, today, timeZone })).today).toEqual(["interview:i"]);
    }
    expect(keys(bucketReminders({ followUps: [], interviews, today, timeZone: "Pacific/Pago_Pago" })).overdue).toEqual([
      "interview:i",
    ]);
  });

  it("orders by day, then interviews by time before follow-ups by company", () => {
    const buckets = bucketReminders({
      followUps: [followUp("globex", "2026-11-17", "Globex"), followUp("acme", "2026-11-17", "Acme Corp"), followUp("early", "2026-11-16")],
      interviews: [interview("late", "2026-11-17T18:00:00Z"), interview("morning", "2026-11-17T09:00:00Z")],
      today,
      timeZone: "UTC",
    });
    expect(keys(buckets).next7Days).toEqual([
      "follow_up:early",
      "interview:morning",
      "interview:late",
      "follow_up:acme",
      "follow_up:globex",
    ]);
  });
});

describe("formatDueIn", () => {
  it("describes the distance from today", () => {
    expect(formatDueIn("2026-11-12", "2026-11-15")).toBe("3 days overdue");
    expect(formatDueIn("2026-11-14", "2026-11-15")).toBe("1 day overdue");
    expect(formatDueIn("2026-11-15", "2026-11-15")).toBe("Today");
    expect(formatDueIn("2026-11-16", "2026-11-15")).toBe("Tomorrow");
    expect(formatDueIn("2026-11-22", "2026-11-15")).toBe("In 7 days");
    expect(formatDueIn("2026-03-01", "2026-02-28")).toBe("Tomorrow");
  });
});

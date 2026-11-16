import { describe, expect, it } from "vitest";

import { followUpState, interviewDueState } from "./follow-ups";

describe("followUpState", () => {
  it("compares the follow-up date with today in the owner's zone", () => {
    const today = "2026-11-14";
    expect(followUpState(null, today)).toBeNull();
    expect(followUpState("2026-11-13", today)).toBe("overdue");
    expect(followUpState("2026-11-14", today)).toBe("today");
    expect(followUpState("2026-11-15", today)).toBe("upcoming");
    expect(followUpState("2025-12-31", "2026-01-01")).toBe("overdue");
  });
});

describe("interviewDueState", () => {
  it("compares the interview's day in the owner's zone with today", () => {
    const today = "2026-12-01";
    // 03:30 UTC on Dec 2 is still Dec 1 in New York.
    expect(interviewDueState("2026-12-02T03:30:00Z", "America/New_York", today)).toBe("today");
    expect(interviewDueState("2026-12-02T03:30:00Z", "UTC", today)).toBe("upcoming");
    expect(interviewDueState("2026-11-30T23:00:00Z", "UTC", today)).toBe("overdue");
    expect(interviewDueState("2026-11-30T23:00:00Z", "Asia/Tokyo", today)).toBe("today");
  });
});

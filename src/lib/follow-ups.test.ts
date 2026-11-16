import { describe, expect, it } from "vitest";

import { followUpState } from "./follow-ups";

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

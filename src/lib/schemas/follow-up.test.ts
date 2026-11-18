import { describe, expect, it } from "vitest";

import { followUpDoneSchema } from "./follow-up";

describe("followUpDoneSchema", () => {
  it("sets the next follow-up with its note", () => {
    expect(followUpDoneSchema.parse({ next_follow_up_on: "2026-11-22", follow_up_note: " Ping Jane " })).toEqual({
      next_follow_up_on: "2026-11-22",
      follow_up_note: "Ping Jane",
    });
  });

  it("clears the note too when the date is blank", () => {
    expect(followUpDoneSchema.parse({ next_follow_up_on: "", follow_up_note: "Ping Jane" })).toEqual({
      next_follow_up_on: null,
      follow_up_note: null,
    });
    expect(followUpDoneSchema.parse({ next_follow_up_on: " ", follow_up_note: "" })).toEqual({
      next_follow_up_on: null,
      follow_up_note: null,
    });
  });

  it("rejects bad dates and too-long notes", () => {
    expect(followUpDoneSchema.safeParse({ next_follow_up_on: "2026-02-30", follow_up_note: "" }).success).toBe(false);
    expect(followUpDoneSchema.safeParse({ next_follow_up_on: "2026-11-22", follow_up_note: "x".repeat(501) }).success).toBe(
      false,
    );
  });
});

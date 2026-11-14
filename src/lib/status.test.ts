import { describe, expect, it } from "vitest";
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUSES, STATUS_META, nextSuggestedStatus } from "./status";

describe("status", () => {
  it("lists the nine PRD statuses in lifecycle order", () => {
    expect(STATUSES).toEqual([
      "saved",
      "applied",
      "screening",
      "interviewing",
      "offer",
      "accepted",
      "rejected",
      "withdrawn",
      "ghosted",
    ]);
  });

  it("splits every status into exactly one of active or closed", () => {
    expect(ACTIVE_STATUSES).toEqual(["saved", "applied", "screening", "interviewing", "offer"]);
    expect([...ACTIVE_STATUSES, ...CLOSED_STATUSES]).toEqual(STATUSES);
  });

  it("has a label for every status", () => {
    for (const s of STATUSES) expect(STATUS_META[s].label).not.toBe("");
  });

  it("suggests the next step on the forward path", () => {
    expect(nextSuggestedStatus("saved")).toBe("applied");
    expect(nextSuggestedStatus("offer")).toBe("accepted");
  });

  it("suggests nothing at the end of or off the forward path", () => {
    expect(nextSuggestedStatus("accepted")).toBeNull();
    expect(nextSuggestedStatus("rejected")).toBeNull();
    expect(nextSuggestedStatus("ghosted")).toBeNull();
  });
});

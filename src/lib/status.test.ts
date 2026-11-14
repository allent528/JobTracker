import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  STATUS_VALUES,
  nextSuggestedStatus,
  statusLabel,
} from "./status";

describe("status", () => {
  it("lists the nine PRD statuses in lifecycle order", () => {
    expect(STATUS_VALUES).toEqual([
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

  it("splits statuses into active and closed with no overlap", () => {
    expect(ACTIVE_STATUSES).toEqual(["saved", "applied", "screening", "interviewing", "offer"]);
    expect(CLOSED_STATUSES).toEqual(["accepted", "rejected", "withdrawn", "ghosted"]);
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

  it("returns display labels", () => {
    expect(statusLabel("interviewing")).toBe("Interviewing");
  });
});

import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  forwardPathFrom,
  isStatus,
  nextSuggestedStatus,
  RESPONSE_RATE_FROM,
  RESPONSE_RATE_STATUSES,
  STATUS_META,
  STATUSES,
} from "./status";

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

describe("isStatus", () => {
  it("recognizes statuses", () => {
    expect(isStatus("applied")).toBe(true);
    expect(isStatus("hired")).toBe(false);
  });
});

describe("forwardPathFrom", () => {
  it("returns the status and everything after it on the forward path", () => {
    expect(forwardPathFrom("applied")).toEqual(["applied", "screening", "interviewing", "offer", "accepted"]);
    expect(forwardPathFrom("accepted")).toEqual(["accepted"]);
  });

  it("is empty for a status off the forward path", () => {
    expect(forwardPathFrom("rejected")).toEqual([]);
  });

  it("builds the response rate sets from RESPONSE_RATE_FROM", () => {
    expect(RESPONSE_RATE_FROM).toEqual({ reached: "applied", responded: "screening" });
    expect(RESPONSE_RATE_STATUSES.reached).toEqual(["applied", "screening", "interviewing", "offer", "accepted"]);
    expect(RESPONSE_RATE_STATUSES.responded).toEqual(["screening", "interviewing", "offer", "accepted", "rejected"]);
  });

  it("counts a rejection as a response, but not withdrawn or ghosted", () => {
    expect(RESPONSE_RATE_STATUSES.responded).toContain("rejected");
    expect(RESPONSE_RATE_STATUSES.responded).not.toContain("withdrawn");
    expect(RESPONSE_RATE_STATUSES.responded).not.toContain("ghosted");
    expect(RESPONSE_RATE_STATUSES.reached).not.toContain("rejected");
  });
});

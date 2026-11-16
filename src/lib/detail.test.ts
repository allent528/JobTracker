import { describe, expect, it } from "vitest";

import { INTERVIEW_KIND_LABELS, INTERVIEW_KINDS, INTERVIEW_OUTCOME_LABELS, INTERVIEW_OUTCOMES } from "./closed-sets";
import {
  type Contact,
  contactFormValues,
  formatDuration,
  type Interview,
  interviewerNames,
  interviewFormValues,
  wasEdited,
} from "./detail";
import { isHttpUrl } from "./schemas/fields";
import { STATUSES, suggestsInterviewing } from "./status";

const contact = (id: string, name: string): Contact => ({
  id,
  name,
  title: null,
  email: null,
  phone: null,
  linkedin_url: null,
  notes: null,
  updated_at: "2026-11-14T10:00:00Z",
});

const interview: Interview = {
  id: "i1",
  kind: "technical",
  scheduled_at: "2026-12-01T15:00:00Z",
  duration_minutes: 90,
  location: null,
  interviewers: null,
  outcome: "pending",
  notes: null,
  updated_at: "2026-11-14T10:00:00Z",
  contact_ids: [],
};

describe("wasEdited", () => {
  it("is true only when updated_at is after created_at", () => {
    expect(wasEdited({ created_at: "2026-11-14T10:00:00Z", updated_at: "2026-11-14T10:00:00Z" })).toBe(false);
    expect(wasEdited({ created_at: "2026-11-14T10:00:00Z", updated_at: "2026-11-14T10:05:00Z" })).toBe(true);
  });
});

describe("contactFormValues", () => {
  it("turns nulls into blank inputs", () => {
    expect(contactFormValues({ ...contact("c1", "Jane Doe"), email: "jane@example.com" })).toEqual({
      name: "Jane Doe",
      title: "",
      email: "jane@example.com",
      phone: "",
      linkedin_url: "",
      notes: "",
    });
  });
});

describe("interviewFormValues", () => {
  it("shows the scheduled time on the owner's wall clock", () => {
    const values = interviewFormValues({ ...interview, contact_ids: ["c1"] }, "America/New_York");
    expect(values).toMatchObject({
      kind: "technical",
      scheduled_at: "2026-12-01T10:00",
      duration_minutes: "90",
      location: "",
      contact_ids: ["c1"],
      outcome: "pending",
    });
  });
});

describe("interviewerNames", () => {
  const contacts = [contact("c1", "Jane Doe"), contact("c2", "John Roe")];

  it("lists picked contacts in contact order, then the free text", () => {
    expect(interviewerNames({ contact_ids: ["c2", "c1"], interviewers: "Pat Example" }, contacts)).toEqual([
      "Jane Doe",
      "John Roe",
      "Pat Example",
    ]);
  });

  it("skips ids that aren't contacts and handles none", () => {
    expect(interviewerNames({ contact_ids: ["gone"], interviewers: null }, contacts)).toEqual([]);
  });
});

describe("formatDuration", () => {
  it.each([
    [45, "45 min"],
    [60, "1 hr"],
    [90, "1 hr 30 min"],
    [1440, "24 hr"],
  ])("%i minutes is %s", (minutes, label) => {
    expect(formatDuration(minutes)).toBe(label);
  });
});

describe("isHttpUrl (interviews.location links)", () => {
  it("accepts only http(s) URLs", () => {
    expect(isHttpUrl("https://meet.example.com/abc")).toBe(true);
    expect(isHttpUrl("HTTP://example.com")).toBe(true);
    for (const value of ["Room 4B", "javascript:alert(1)", "meet.example.com/abc", "https://", " https://x.com"]) {
      expect(isHttpUrl(value)).toBe(false);
    }
  });
});

describe("suggestsInterviewing (F7)", () => {
  it("suggests only for the first interview while applied or screening", () => {
    const suggested = STATUSES.filter((status) => suggestsInterviewing(status, 1));
    expect(suggested).toEqual(["applied", "screening"]);
    expect(suggestsInterviewing("applied", 2)).toBe(false);
    expect(suggestsInterviewing("screening", 0)).toBe(false);
  });
});

describe("interview labels", () => {
  it("label every kind and outcome", () => {
    expect(Object.keys(INTERVIEW_KIND_LABELS)).toEqual([...INTERVIEW_KINDS]);
    expect(Object.keys(INTERVIEW_OUTCOME_LABELS)).toEqual([...INTERVIEW_OUTCOMES]);
  });
});

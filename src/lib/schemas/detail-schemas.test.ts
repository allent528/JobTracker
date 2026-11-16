import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/lib/limits";

import { type ContactFormValues, contactSchema, EMPTY_CONTACT_FORM } from "./contact";
import { EMPTY_INTERVIEW_FORM, type InterviewFormValues, interviewSchema } from "./interview";
import { noteSchema } from "./note";

const CONTACT_ID = "6f1c1e8e-3b2a-4c47-9d55-0e7f3f1b2a10";

function firstError(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, path: string) {
  expect(result.success).toBe(false);
  return result.error?.issues.find((issue) => issue.path.join(".") === path)?.message;
}

describe("noteSchema", () => {
  it("keeps the body as typed, trimmed at the ends", () => {
    expect(noteSchema.parse({ body: "  # Call notes\n\n- *ask* about [team](https://example.com)  " })).toEqual({
      body: "# Call notes\n\n- *ask* about [team](https://example.com)",
    });
  });

  it("rejects a blank or oversized body (notes_body_not_blank, notes_body_length)", () => {
    expect(firstError(noteSchema.safeParse({ body: "   " }), "body")).toBe("Enter the note.");
    const max = TEXT_LIMITS.notes.body;
    expect(noteSchema.safeParse({ body: "a".repeat(max) }).success).toBe(true);
    expect(firstError(noteSchema.safeParse({ body: "a".repeat(max + 1) }), "body")).toMatch(/20,000 characters/);
  });
});

describe("contactSchema", () => {
  const parse = (overrides: Partial<ContactFormValues>) =>
    contactSchema.safeParse({ ...EMPTY_CONTACT_FORM, name: "Jane Doe", ...overrides });

  it("turns blanks into nulls", () => {
    expect(parse({}).data).toEqual({
      name: "Jane Doe",
      title: null,
      email: null,
      phone: null,
      linkedin_url: null,
      notes: null,
    });
  });

  it("keeps every field", () => {
    const values = {
      name: "Jane Doe",
      title: "Recruiter",
      email: "jane@example.com",
      phone: "555-0100",
      linkedin_url: "https://www.linkedin.com/in/jane-doe-example",
      notes: "Met at a meetup",
    };
    expect(parse(values).data).toEqual(values);
  });

  it("requires a name", () => {
    expect(firstError(parse({ name: " " }), "name")).toBe("Enter the name.");
  });

  it("rejects a malformed email and a non-http LinkedIn link (contacts_linkedin_url_http)", () => {
    expect(firstError(parse({ email: "not-an-email" }), "email")).toMatch(/email address/);
    expect(firstError(parse({ linkedin_url: "javascript:alert(1)" }), "linkedin_url")).toMatch(/http/);
    expect(firstError(parse({ linkedin_url: "linkedin.com/in/jane" }), "linkedin_url")).toMatch(/http/);
  });

  it("mirrors the length limits", () => {
    const limits = TEXT_LIMITS.contacts;
    for (const [name, max] of [
      ["name", limits.name],
      ["title", limits.title],
      ["phone", limits.phone],
      ["notes", limits.notes],
    ] as const) {
      expect(parse({ [name]: "a".repeat(max) }).success).toBe(true);
      expect(firstError(parse({ [name]: "a".repeat(max + 1) }), name)).toMatch(/characters or fewer/);
    }
    const longEmail = `${"a".repeat(limits.email)}@example.com`;
    expect(parse({ email: longEmail }).success).toBe(false);
  });
});

describe("interviewSchema", () => {
  const parse = (overrides: Partial<InterviewFormValues>) =>
    interviewSchema.safeParse({ ...EMPTY_INTERVIEW_FORM, scheduled_at: "2026-12-01T10:00", ...overrides });

  it("defaults to a pending phone screen and turns blanks into nulls", () => {
    expect(parse({}).data).toEqual({
      kind: "phone_screen",
      scheduled_at: "2026-12-01T10:00",
      duration_minutes: null,
      location: null,
      interviewers: null,
      contact_ids: [],
      outcome: "pending",
      notes: null,
    });
  });

  it("parses the duration and de-duplicates picked contacts", () => {
    const result = parse({ duration_minutes: " 45 ", contact_ids: [CONTACT_ID, CONTACT_ID] });
    expect(result.data?.duration_minutes).toBe(45);
    expect(result.data?.contact_ids).toEqual([CONTACT_ID]);
  });

  it("requires a real date and time", () => {
    for (const scheduled_at of ["", "2026-12-01", "2026-02-30T10:00", "2026-12-01T24:00", "2026-12-01 10:00"]) {
      expect(firstError(parse({ scheduled_at }), "scheduled_at")).toBe("Enter the date and time.");
    }
  });

  it("mirrors interviews_duration_minutes_range", () => {
    expect(parse({ duration_minutes: "1" }).success).toBe(true);
    expect(parse({ duration_minutes: "1440" }).success).toBe(true);
    expect(firstError(parse({ duration_minutes: "0" }), "duration_minutes")).toMatch(/between 1 and 1,440/);
    expect(firstError(parse({ duration_minutes: "1441" }), "duration_minutes")).toMatch(/between/);
    expect(firstError(parse({ duration_minutes: "1.5" }), "duration_minutes")).toMatch(/whole minutes/);
  });

  it("rejects kinds and outcomes outside the closed sets", () => {
    expect(firstError(parse({ kind: "coffee" as InterviewFormValues["kind"] }), "kind")).toBeDefined();
    expect(firstError(parse({ outcome: "maybe" as InterviewFormValues["outcome"] }), "outcome")).toBeDefined();
  });

  it("rejects a picked contact that isn't an id", () => {
    expect(firstError(parse({ contact_ids: ["nope"] }), "contact_ids.0")).toBe("That contact no longer exists.");
  });

  it("mirrors the length limits", () => {
    const limits = TEXT_LIMITS.interviews;
    for (const [name, max] of [
      ["location", limits.location],
      ["interviewers", limits.interviewers],
      ["notes", limits.notes],
    ] as const) {
      expect(parse({ [name]: "a".repeat(max) }).success).toBe(true);
      expect(firstError(parse({ [name]: "a".repeat(max + 1) }), name)).toMatch(/characters or fewer/);
    }
  });
});

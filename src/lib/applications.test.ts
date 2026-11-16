import { describe, expect, it } from "vitest";

import {
  type Application,
  applicationPath,
  editApplicationPath,
  EMPTY_APPLICATION_FORM,
  formatSalaryRange,
  initialStatus,
  parsePipelineView,
  pipelineViewPath,
  toFormValues,
} from "./applications";
import { writeErrorMessage } from "./db-errors";
import { applicationSchema } from "./schemas/application";

const ROW: Application = {
  id: "6f1c1e8e-3b2a-4c47-9d55-0e7f3f1b2a10",
  user_id: "0a0a0a0a-0000-4000-8000-000000000000",
  company: "Acme Corp",
  role_title: "Software Engineer",
  job_url: null,
  location: "Springfield",
  work_mode: "remote",
  salary_min: 100000,
  salary_max: null,
  salary_currency: "USD",
  source: null,
  description: null,
  status: "saved",
  date_applied: null,
  next_follow_up_on: "2026-11-20",
  follow_up_note: null,
  archived_at: null,
  created_at: "2026-11-14T12:00:00+00:00",
  updated_at: "2026-11-14T12:00:00+00:00",
};

describe("initialStatus (F2)", () => {
  it("starts in applied when a date applied is set, otherwise saved", () => {
    expect(initialStatus("2026-11-01")).toBe("applied");
    expect(initialStatus(null)).toBe("saved");
  });
});

describe("toFormValues", () => {
  it("turns nulls into blank inputs and numbers into strings", () => {
    expect(toFormValues(ROW)).toEqual({
      ...EMPTY_APPLICATION_FORM,
      company: "Acme Corp",
      role_title: "Software Engineer",
      location: "Springfield",
      work_mode: "remote",
      salary_min: "100000",
      next_follow_up_on: "2026-11-20",
    });
  });

  it("round-trips through the schema to the same column values", () => {
    const parsed = applicationSchema.parse(toFormValues(ROW));
    for (const [key, value] of Object.entries(parsed)) {
      expect(ROW[key as keyof Application]).toBe(value);
    }
  });
});

describe("formatSalaryRange", () => {
  it("formats ranges, open ends and single values", () => {
    expect(formatSalaryRange(120000, 150000, "USD")).toBe("$120,000 – $150,000");
    expect(formatSalaryRange(120000, null, "USD")).toBe("From $120,000");
    expect(formatSalaryRange(null, 150000, "EUR")).toBe("Up to €150,000");
    expect(formatSalaryRange(90000, 90000, "USD")).toBe("$90,000");
    expect(formatSalaryRange(null, null, "USD")).toBeNull();
  });

  it("shows a well-formed but unknown currency code as-is", () => {
    // Intl separates the code from the amount with a no-break space.
    expect(formatSalaryRange(150000, null, "ZZZ")).toBe("From ZZZ\u00a0150,000");
  });
});

describe("paths", () => {
  it("builds detail and edit paths", () => {
    expect(applicationPath("abc")).toBe("/applications/abc");
    expect(editApplicationPath("abc")).toBe("/applications/abc/edit");
  });
});

describe("writeErrorMessage", () => {
  it("maps database error codes to copy without echoing the database message", () => {
    expect(writeErrorMessage({ code: "23514" })).toMatch(/aren't allowed/);
    expect(writeErrorMessage({ code: "42501" })).toMatch(/can't make that change/);
    expect(writeErrorMessage({ code: "23503" })).toMatch(/can't make that change/);
    expect(writeErrorMessage({ code: "XX000" })).toMatch(/couldn't save/);
    expect(writeErrorMessage(null)).toMatch(/couldn't save/);
  });
});

describe("pipeline views", () => {
  it("defaults to the board and round-trips the table view", () => {
    expect(parsePipelineView(undefined)).toBe("board");
    expect(parsePipelineView("bogus")).toBe("board");
    expect(parsePipelineView(["table", "board"])).toBe("board");
    expect(parsePipelineView("table")).toBe("table");
    expect(pipelineViewPath("board")).toBe("/applications");
    expect(pipelineViewPath("table")).toBe("/applications?view=table");
  });
});

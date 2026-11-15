import { describe, expect, it } from "vitest";

import { EMPTY_APPLICATION_FORM } from "@/lib/applications";
import { TEXT_LIMITS } from "@/lib/limits";
import { STATUSES } from "@/lib/status";

import {
  type ApplicationFormValues,
  applicationSchema,
  SALARY_MAX_VALUE,
  statusChangeSchema,
} from "./application";

const LIMITS = TEXT_LIMITS.applications;
const ID = "6f1c1e8e-3b2a-4c47-9d55-0e7f3f1b2a10";

function parse(overrides: Partial<ApplicationFormValues>) {
  return applicationSchema.safeParse({
    ...EMPTY_APPLICATION_FORM,
    company: "Acme Corp",
    role_title: "Software Engineer",
    ...overrides,
  });
}

function errorFor(overrides: Partial<ApplicationFormValues>, path: string) {
  const result = parse(overrides);
  expect(result.success).toBe(false);
  return result.error?.issues.find((issue) => issue.path.join(".") === path)?.message;
}

describe("applicationSchema", () => {
  it("turns blank optional inputs into nulls and keeps the default currency", () => {
    const result = parse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      company: "Acme Corp",
      role_title: "Software Engineer",
      job_url: null,
      location: null,
      work_mode: null,
      salary_min: null,
      salary_max: null,
      salary_currency: "USD",
      source: null,
      date_applied: null,
      description: null,
      next_follow_up_on: null,
      follow_up_note: null,
    });
  });

  it("parses a fully filled form into column values", () => {
    const result = parse({
      company: "  Acme Corp  ",
      job_url: "https://jobs.example.com/123",
      location: "Springfield",
      work_mode: "hybrid",
      salary_min: "120,000",
      salary_max: "150000",
      salary_currency: "eur",
      source: "Referral",
      date_applied: "2026-11-01",
      description: "Build things.",
      next_follow_up_on: "2026-11-20",
      follow_up_note: "Email the recruiter",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      company: "Acme Corp",
      work_mode: "hybrid",
      salary_min: 120000,
      salary_max: 150000,
      salary_currency: "EUR",
      date_applied: "2026-11-01",
      next_follow_up_on: "2026-11-20",
    });
  });

  it("requires a non-blank company and role title (applications_*_not_blank)", () => {
    expect(errorFor({ company: "   " }, "company")).toBe("Enter the company.");
    expect(errorFor({ role_title: "" }, "role_title")).toBe("Enter the role title.");
  });

  it("enforces the TEXT_LIMITS lengths", () => {
    const cases = [
      ["company", LIMITS.company],
      ["role_title", LIMITS.role_title],
      ["location", LIMITS.location],
      ["source", LIMITS.source],
      ["description", LIMITS.description],
      ["follow_up_note", LIMITS.follow_up_note],
    ] as const;
    for (const [field, max] of cases) {
      expect(parse({ [field]: "a".repeat(max) }).success).toBe(true);
      expect(errorFor({ [field]: "a".repeat(max + 1) }, field)).toMatch(/characters or fewer/);
    }
    const url = (length: number) => `https://example.com/${"a".repeat(length - 20)}`;
    expect(parse({ job_url: url(LIMITS.job_url) }).success).toBe(true);
    expect(parse({ job_url: url(LIMITS.job_url + 1) }).success).toBe(false);
  });

  it("only accepts http(s) job links (applications_job_url_http)", () => {
    expect(parse({ job_url: "http://example.com" }).success).toBe(true);
    expect(parse({ job_url: "HTTPS://example.com/a" }).success).toBe(true);
    for (const bad of ["javascript:alert(1)", "example.com", "ftp://example.com", "https://"]) {
      expect(errorFor({ job_url: bad }, "job_url")).toMatch(/http/);
    }
  });

  it("accepts whole, non-negative salaries within integer range", () => {
    expect(parse({ salary_min: "0" }).data?.salary_min).toBe(0);
    expect(parse({ salary_max: String(SALARY_MAX_VALUE) }).success).toBe(true);
    expect(errorFor({ salary_max: String(SALARY_MAX_VALUE + 1) }, "salary_max")).toBe("That number is too large.");
    for (const bad of ["-1", "1.5", "12k", "$100"]) {
      expect(errorFor({ salary_min: bad }, "salary_min")).toMatch(/whole number/);
    }
  });

  it("rejects a maximum below the minimum (applications_salary_range)", () => {
    expect(errorFor({ salary_min: "200", salary_max: "100" }, "salary_max")).toMatch(/less than the minimum/);
    expect(parse({ salary_min: "100", salary_max: "100" }).success).toBe(true);
    expect(parse({ salary_min: "100" }).success).toBe(true);
  });

  it("requires a 3-letter currency code (applications_salary_currency_iso)", () => {
    expect(parse({ salary_currency: "gbp" }).data?.salary_currency).toBe("GBP");
    for (const bad of ["", "US", "USDX", "U$D"]) {
      expect(errorFor({ salary_currency: bad }, "salary_currency")).toMatch(/3-letter/);
    }
  });

  it("only accepts known work modes", () => {
    expect(parse({ work_mode: "remote" }).data?.work_mode).toBe("remote");
    expect(parse({ work_mode: "office" as ApplicationFormValues["work_mode"] }).success).toBe(false);
  });

  it("only accepts real YYYY-MM-DD dates", () => {
    expect(errorFor({ date_applied: "2026-02-30" }, "date_applied")).toBe("Enter a valid date.");
    expect(errorFor({ next_follow_up_on: "11/20/2026" }, "next_follow_up_on")).toBe("Enter a valid date.");
  });
});

describe("statusChangeSchema", () => {
  it("accepts every status", () => {
    for (const status of STATUSES) expect(statusChangeSchema.safeParse({ id: ID, status }).success).toBe(true);
  });

  it("rejects unknown statuses and bad ids", () => {
    expect(statusChangeSchema.safeParse({ id: ID, status: "hired" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ id: "not-a-uuid", status: "saved" }).success).toBe(false);
  });
});

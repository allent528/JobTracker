import { z } from "zod";

import { WORK_MODES } from "@/lib/closed-sets";
import { TEXT_LIMITS } from "@/lib/limits";
import { STATUSES } from "@/lib/status";

const LIMITS = TEXT_LIMITS.applications;

/** Largest value a Postgres `integer` column holds. */
export const SALARY_MAX_VALUE = 2_147_483_647;

export const DEFAULT_CURRENCY = "USD";

const HTTP_URL = /^https?:\/\//i;
const WHOLE_NUMBER = /^\d+$/;

function tooLong(max: number) {
  return `Keep this to ${max.toLocaleString("en-US")} characters or fewer.`;
}

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, { error: `Enter the ${label}.` })
    .max(max, { error: tooLong(max) });
}

/** Blank becomes null. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: tooLong(max) })
    .transform((value) => value || null);
}

const jobUrl = z
  .string()
  .trim()
  .max(LIMITS.job_url, { error: tooLong(LIMITS.job_url) })
  .refine((value) => value === "" || (HTTP_URL.test(value) && URL.canParse(value)), {
    error: "Enter a full link starting with http:// or https://.",
  })
  .transform((value) => value || null);

/** Whole currency units; commas are allowed for readability ("120,000"). Blank becomes null. */
const salary = z
  .string()
  .trim()
  .transform((value) => value.replaceAll(",", ""))
  .refine((value) => value === "" || WHOLE_NUMBER.test(value), {
    error: "Enter a whole number, like 120000.",
  })
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || value <= SALARY_MAX_VALUE, {
    error: "That number is too large.",
  });

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, { error: "Use a 3-letter currency code, like USD." });

const workMode = z
  .enum(["", ...WORK_MODES], { error: "Choose a work mode." })
  .transform((value) => value || null);

/** `YYYY-MM-DD` from a date input; blank becomes null. */
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || z.iso.date().safeParse(value).success, {
    error: "Enter a valid date.",
  })
  .transform((value) => value || null);

/** Inputs are strings; the output matches the columns. */
export const applicationSchema = z
  .object({
    company: requiredText("company", LIMITS.company),
    role_title: requiredText("role title", LIMITS.role_title),
    job_url: jobUrl,
    location: optionalText(LIMITS.location),
    work_mode: workMode,
    salary_min: salary,
    salary_max: salary,
    salary_currency: currency,
    source: optionalText(LIMITS.source),
    date_applied: optionalDate,
    description: optionalText(LIMITS.description),
    next_follow_up_on: optionalDate,
    follow_up_note: optionalText(LIMITS.follow_up_note),
  })
  .refine(
    ({ salary_min, salary_max }) =>
      salary_min === null || salary_max === null || salary_min <= salary_max,
    { error: "The maximum can't be less than the minimum.", path: ["salary_max"] },
  );

export type ApplicationFormValues = z.input<typeof applicationSchema>;

export const applicationIdSchema = z.uuid({ error: "That application doesn't exist." });

export const statusChangeSchema = z.object({
  id: applicationIdSchema,
  status: z.enum(STATUSES, { error: "Choose a status." }),
});

export type StatusChangeInput = z.input<typeof statusChangeSchema>;

export const archiveSchema = z.object({
  id: applicationIdSchema,
  archived: z.boolean(),
});

export type ArchiveInput = z.input<typeof archiveSchema>;

import { z } from "zod";

// Field builders shared by the feature schemas. Each mirrors a database check (non-blank text,
// `<table>_<col>_length`, `^https?://` links) so the form rejects what the database would.

const HTTP_URL = /^https?:\/\//i;

export function tooLong(max: number) {
  return `Keep this to ${max.toLocaleString("en-US")} characters or fewer.`;
}

export function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, { error: `Enter the ${label}.` })
    .max(max, { error: tooLong(max) });
}

/** Blank becomes null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: tooLong(max) })
    .transform((value) => value || null);
}

/** An http(s) link or blank (null). */
export function optionalHttpUrl(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: tooLong(max) })
    .refine((value) => value === "" || isHttpUrl(value), {
      error: "Enter a full link starting with http:// or https://.",
    })
    .transform((value) => value || null);
}

/** Also decides whether free text (interviews.location) renders as a link (ui.md). */
export function isHttpUrl(value: string): boolean {
  return HTTP_URL.test(value) && URL.canParse(value);
}

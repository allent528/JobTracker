import { type ApplicationFormValues, DEFAULT_CURRENCY } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import type { Tables } from "@/types/database.types";

export type Application = Tables<"applications">;

export const NEW_APPLICATION_PATH = "/applications/new";

export function applicationPath(id: string): string {
  return `/applications/${id}`;
}

export function editApplicationPath(id: string): string {
  return `${applicationPath(id)}/edit`;
}

/** F2: new applications start in `applied` when a date applied is set, otherwise in `saved`. */
export function initialStatus(dateApplied: string | null): Status {
  return dateApplied ? "applied" : "saved";
}

export const EMPTY_APPLICATION_FORM: ApplicationFormValues = {
  company: "",
  role_title: "",
  job_url: "",
  location: "",
  work_mode: "",
  salary_min: "",
  salary_max: "",
  salary_currency: DEFAULT_CURRENCY,
  source: "",
  date_applied: "",
  description: "",
  next_follow_up_on: "",
  follow_up_note: "",
};

/** A stored application as edit-form values (nulls become blank inputs). */
export function toFormValues(app: Application): ApplicationFormValues {
  const text = (value: string | null) => value ?? "";
  const num = (value: number | null) => (value === null ? "" : String(value));
  return {
    company: app.company,
    role_title: app.role_title,
    job_url: text(app.job_url),
    location: text(app.location),
    work_mode: (app.work_mode ?? "") as ApplicationFormValues["work_mode"],
    salary_min: num(app.salary_min),
    salary_max: num(app.salary_max),
    salary_currency: app.salary_currency,
    source: text(app.source),
    date_applied: text(app.date_applied),
    description: text(app.description),
    next_follow_up_on: text(app.next_follow_up_on),
    follow_up_note: text(app.follow_up_note),
  };
}

/** "$120,000 – $150,000", "From $120,000", "Up to $150,000", or null when neither is set. */
export function formatSalaryRange(min: number | null, max: number | null, currency: string): string | null {
  const format = (n: number) => formatMoney(n, currency);
  if (max === null) return min === null ? null : `From ${format(min)}`;
  if (min === null) return `Up to ${format(max)}`;
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // A well-formed but unknown code (e.g. "ZZZ") makes Intl throw.
    return `${amount.toLocaleString("en-US")} ${currency}`;
  }
}

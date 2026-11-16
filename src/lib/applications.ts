import type { WorkMode } from "@/lib/closed-sets";
import { type ApplicationFormValues, DEFAULT_CURRENCY } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import type { Tables } from "@/types/database.types";

/** An applications row with `status` and `work_mode` narrowed (see application-queries.ts). */
export type Application = Omit<Tables<"applications">, "status" | "work_mode"> & {
  status: Status;
  work_mode: WorkMode | null;
};

export const APPLICATION_NOT_FOUND = "That application no longer exists.";

export const APPLICATIONS_PATH = "/applications";

export const NEW_APPLICATION_PATH = `${APPLICATIONS_PATH}/new`;

export function applicationPath(id: string): string {
  return `${APPLICATIONS_PATH}/${id}`;
}

export function editApplicationPath(id: string): string {
  return `${applicationPath(id)}/edit`;
}

/** New applications start in `applied` when a date applied is set, otherwise in `saved`. */
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

/** Edit-form values for a stored application: nulls become blank inputs. */
export function toFormValues(app: Application): ApplicationFormValues {
  const text = (value: string | null) => value ?? "";
  const num = (value: number | null) => (value === null ? "" : String(value));
  return {
    company: app.company,
    role_title: app.role_title,
    job_url: text(app.job_url),
    location: text(app.location),
    work_mode: app.work_mode ?? "",
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
  const format = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (max === null) return min === null ? null : `From ${format(min)}`;
  if (min === null) return `Up to ${format(max)}`;
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

export const PIPELINE_VIEWS = ["board", "table"] as const;
export type PipelineView = (typeof PIPELINE_VIEWS)[number];
export const VIEW_PARAM = "view";
const DEFAULT_VIEW: PipelineView = "board";

export function parsePipelineView(value: string | string[] | undefined): PipelineView {
  return PIPELINE_VIEWS.find((view) => view === value) ?? DEFAULT_VIEW;
}

export function pipelineViewPath(view: PipelineView): string {
  return view === DEFAULT_VIEW ? APPLICATIONS_PATH : `${APPLICATIONS_PATH}?${VIEW_PARAM}=${view}`;
}

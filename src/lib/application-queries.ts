import "server-only";

import { notFound } from "next/navigation";

import type { Application } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import type { WorkMode } from "@/lib/closed-sets";
import { dateInTimeZone, daysBetween } from "@/lib/dates";
import type { PipelineItem } from "@/lib/pipeline";
import { getTimeZone } from "@/lib/profile";
import { applicationIdSchema } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

// Narrowing casts below are the one place stored text becomes `Status` / `WorkMode`. They're safe
// because the applications_status_check and applications_work_mode_check constraints only allow
// those values, and check-constraints.test.ts keeps the constraints equal to STATUSES and
// WORK_MODES. status_events copies a checked status in its trigger, so renaming or removing a
// status must migrate status_events rows in the same migration (database.md).

export type StatusEvent = Pick<Tables<"status_events">, "id" | "changed_at"> & {
  from_status: Status | null;
  to_status: Status;
};

/** Calls `notFound()` for a bad id, a missing row, or another user's row. */
export async function getApplicationOrNotFound(id: string): Promise<Application> {
  const user = await getCurrentUser();
  const parsed = applicationIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Couldn't load the application.");
  if (!data) notFound();
  return data as Application;
}

/** Newest first. */
export async function getStatusHistory(applicationId: string): Promise<StatusEvent[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("status_events")
    .select("id, from_status, to_status, changed_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("changed_at", { ascending: false });
  if (error) throw new Error("Couldn't load the status history.");
  return data as StatusEvent[];
}

// The latest status event is when the current status began: the trigger logs every change (D5).
// PostgREST applies the embedded order and limit per application, so this stays one query.
const PIPELINE_COLUMNS =
  "id, company, role_title, status, work_mode, date_applied, next_follow_up_on, archived_at, created_at, updated_at, status_events(changed_at)" as const;

/**
 * Every application, archived ones included (the views filter them, D10), with days in the current
 * status counted in the owner's time zone. `today` is that zone's date, for follow-up states.
 */
export async function listPipeline(): Promise<{ items: PipelineItem[]; today: string; timeZone: string }> {
  const [user, timeZone] = await Promise.all([getCurrentUser(), getTimeZone()]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(PIPELINE_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .order("changed_at", { referencedTable: "status_events", ascending: false })
    .limit(1, { referencedTable: "status_events" });
  if (error) throw new Error("Couldn't load your applications.");

  const today = dateInTimeZone(new Date(), timeZone);
  const items = data.map(({ status_events, created_at, status, work_mode, ...row }) => ({
    ...row,
    status: status as Status,
    work_mode: work_mode as WorkMode | null,
    days_in_status: daysBetween(dateInTimeZone(status_events[0]?.changed_at ?? created_at, timeZone), today),
  }));
  return { items, today, timeZone };
}

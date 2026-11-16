import "server-only";

import { notFound } from "next/navigation";

import type { Application } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import type { PipelineItem } from "@/lib/pipeline";
import { selectPipeline, toPipelineItems } from "@/lib/pipeline-query";
import { getTimeZone, getToday } from "@/lib/profile";
import { applicationIdSchema } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

// Narrowing casts here and in pipeline-query.ts are the only places stored text becomes `Status` / `WorkMode`. They're safe
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

export async function listPipeline(): Promise<PipelineItem[]> {
  const [user, timeZone, today] = await Promise.all([getCurrentUser(), getTimeZone(), getToday()]);
  const supabase = await createClient();
  const { data, error } = await selectPipeline(supabase, user.id);
  if (error) throw new Error("Couldn't load your applications.");
  return toPipelineItems(data, timeZone, today);
}

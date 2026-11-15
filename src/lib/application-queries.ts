import "server-only";

import type { QueryData } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

import type { Application } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { applicationIdSchema } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

// Narrowing casts below are the one place stored text becomes `Status` / `WorkMode`. They're safe
// because the applications_status_check and applications_work_mode_check constraints only allow
// those values, and check-constraints.test.ts keeps the constraints equal to STATUSES and
// WORK_MODES. status_events copies a checked status in its trigger, so renaming or removing a
// status must migrate status_events rows in the same migration (database.md).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type StatusEvent = Pick<Tables<"status_events">, "id" | "changed_at"> & {
  from_status: Status | null;
  to_status: Status;
};

const LIST_COLUMNS = "id, company, role_title, status, archived_at, updated_at" as const;

function listQuery(supabase: Supabase, userId: string) {
  return supabase
    .from("applications")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
}

export type ApplicationListItem = Omit<QueryData<ReturnType<typeof listQuery>>[number], "status"> & {
  status: Status;
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

/** Archived applications are left out unless `includeArchived` (D10). */
export async function listApplications({
  includeArchived,
}: {
  includeArchived: boolean;
}): Promise<ApplicationListItem[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  let query = listQuery(supabase, user.id);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("Couldn't load your applications.");
  return data as ApplicationListItem[];
}

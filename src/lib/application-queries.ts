import "server-only";

import { notFound } from "next/navigation";

import type { Application } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import type { Contact, Interview, Note } from "@/lib/detail";
import { selectUpcomingInterviews, toUpcomingInterviews, type UpcomingInterview } from "@/lib/interview-query";
import type { PipelineItem } from "@/lib/pipeline";
import { selectPipeline, toPipelineItems } from "@/lib/pipeline-query";
import { getTimeZone, getToday } from "@/lib/profile";
import { applicationIdSchema } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

// Narrowing casts here, in pipeline-query.ts and in interview-query.ts are the only places stored text becomes
// `Status` / `WorkMode` / `InterviewKind` / `InterviewOutcome`. They're safe because the
// applications_status_check, applications_work_mode_check, interviews_kind_check and
// interviews_outcome_check constraints only allow those values, and check-constraints.test.ts
// keeps the constraints equal to the TS constants. status_events copies a checked status in its trigger, so renaming or removing a
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

/** F5: newest first. */
export async function listNotes(applicationId: string): Promise<Note[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, body, created_at, updated_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Couldn't load the notes.");
  return data;
}

/** F6: in the order they were added. */
export async function listContacts(applicationId: string): Promise<Contact[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, title, email, phone, linkedin_url, notes, updated_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new Error("Couldn't load the contacts.");
  return data;
}

/** F7: in schedule order, each with the ids of the contacts picked as interviewers. */
export async function listInterviews(applicationId: string): Promise<Interview[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviews")
    .select(
      "id, kind, scheduled_at, duration_minutes, location, interviewers, outcome, notes, updated_at, interview_contacts(contact_id)",
    )
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("scheduled_at");
  if (error) throw new Error("Couldn't load the interviews.");
  // kind / outcome narrowing: see the comment at the top of this file.
  return data.map(({ interview_contacts, ...row }) => ({
    ...(row as Omit<Interview, "contact_ids">),
    contact_ids: interview_contacts.map((link) => link.contact_id),
  }));
}

/**
 * Pending interviews scheduled in [from, until) (ISO instants), soonest first, on applications
 * that aren't archived. For the reminders home page (F8).
 */
export async function listUpcomingInterviews(range: { from: string; until: string }): Promise<UpcomingInterview[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await selectUpcomingInterviews(supabase, user.id, range);
  if (error) throw new Error("Couldn't load your interviews.");
  return toUpcomingInterviews(data);
}

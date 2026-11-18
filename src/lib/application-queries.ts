import "server-only";

import { notFound } from "next/navigation";

import type { Application } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { type DateOnly, startOfDayInstant } from "@/lib/dates";
import type { Contact, Interview, Note } from "@/lib/detail";
import { selectUpcomingInterviews, toUpcomingInterviews, type UpcomingInterview } from "@/lib/interview-query";
import type { PipelineItem } from "@/lib/pipeline";
import { selectPipeline, toPipelineItems } from "@/lib/pipeline-query";
import { selectDueFollowUps, toDueFollowUps } from "@/lib/reminder-query";
import type { DueFollowUp } from "@/lib/reminders";
import { getTimeZone, getToday } from "@/lib/profile";
import { applicationIdSchema } from "@/lib/schemas/application";
import type { Status } from "@/lib/status";
import type { Stats } from "@/lib/stats";
import { selectStats } from "@/lib/stats-query";
import { storedInterviewKind, storedInterviewOutcome, storedStatus, storedWorkMode } from "@/lib/stored";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

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
  return { ...data, status: storedStatus(data.status), work_mode: storedWorkMode(data.work_mode) };
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
  return data.map((event) => ({
    ...event,
    from_status: event.from_status === null ? null : storedStatus(event.from_status),
    to_status: storedStatus(event.to_status),
  }));
}

export async function listPipeline(): Promise<PipelineItem[]> {
  const [user, timeZone, today] = await Promise.all([getCurrentUser(), getTimeZone(), getToday()]);
  const supabase = await createClient();
  const { data, error } = await selectPipeline(supabase, user.id);
  if (error) throw new Error("Couldn't load your applications.");
  return toPipelineItems(data, timeZone, today);
}

/** Newest first. */
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

/** In the order they were added. */
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

/** In schedule order. */
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
  return data.map(({ interview_contacts, kind, outcome, ...row }) => ({
    ...row,
    kind: storedInterviewKind(kind),
    outcome: storedInterviewOutcome(outcome),
    contact_ids: interview_contacts.map((link) => link.contact_id),
  }));
}

/** Pending rounds before the start of `untilDay` in the owner's time zone, with no lower bound. */
export async function listUpcomingInterviews(untilDay: DateOnly): Promise<UpcomingInterview[]> {
  const [user, timeZone] = await Promise.all([getCurrentUser(), getTimeZone()]);
  const supabase = await createClient();
  const { data, error } = await selectUpcomingInterviews(supabase, user.id, {
    until: startOfDayInstant(untilDay, timeZone).toISOString(),
  });
  if (error) throw new Error("Couldn't load your interviews.");
  return toUpcomingInterviews(data);
}

export async function listDueFollowUps(untilDay: DateOnly): Promise<DueFollowUp[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await selectDueFollowUps(supabase, user.id, untilDay);
  if (error) throw new Error("Couldn't load your follow-ups.");
  return toDueFollowUps(data);
}

export async function getStats(includeArchived: boolean): Promise<Stats> {
  const today = await getToday();
  const supabase = await createClient();
  return selectStats(supabase, { today, includeArchived });
}

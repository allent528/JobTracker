"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult, parseOr } from "@/lib/action-result";
import { APPLICATION_NOT_FOUND, applicationPath } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { writeErrorMessage } from "@/lib/db-errors";
import { localDateTimeToInstant } from "@/lib/dates";
import { CONTACT_NOT_FOUND, INTERVIEW_NOT_FOUND, NOTE_NOT_FOUND } from "@/lib/detail";
import { type ChildRow, type ChildTable, deleteOwnChild, insertChild, updateOwnChild } from "@/lib/owned-rows";
import { getTimeZone } from "@/lib/profile";
import { type ContactFormValues, contactSchema } from "@/lib/schemas/contact";
import { type InterviewFormValues, type InterviewInput, interviewSchema } from "@/lib/schemas/interview";
import { type NoteFormValues, noteSchema } from "@/lib/schemas/note";
import { isStatus, suggestsInterviewing } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

// Notes, contacts and interviews on the application detail page (F5–F7). Each action re-checks
// the user, parses with the form's schema, writes only granted columns and revalidates the page.

const PICKED_CONTACT_GONE = "One of the picked interviewers is no longer a contact here. Reload and try again.";

const NOT_FOUND: Record<ChildTable, string> = {
  notes: NOTE_NOT_FOUND,
  contacts: CONTACT_NOT_FOUND,
  interviews: INTERVIEW_NOT_FOUND,
};

function rowId(table: ChildTable | "applications", id: unknown): ActionResult<string> {
  const missing = table === "applications" ? APPLICATION_NOT_FOUND : NOT_FOUND[table];
  return parseOr(z.uuid({ error: missing }), id);
}

// Step 7 adds the home page (`/`) here for interviews.
function revalidateDetail(row: ChildRow): ActionResult {
  revalidatePath(applicationPath(row.application_id));
  return { ok: true, data: undefined };
}

async function deleteChild(table: ChildTable, id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsedId = rowId(table, id);
  if (!parsedId.ok) return parsedId;
  const result = await deleteOwnChild(table, user.id, parsedId.data, NOT_FOUND[table]);
  return result.ok ? revalidateDetail(result.data) : result;
}

// Notes (F5)

export async function createNote(applicationId: string, input: NoteFormValues): Promise<ActionResult> {
  await getCurrentUser();
  const parsedId = rowId("applications", applicationId);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(noteSchema, input);
  if (!parsed.ok) return parsed;

  const result = await insertChild(
    "notes",
    { application_id: parsedId.data, body: parsed.data.body },
    APPLICATION_NOT_FOUND,
  );
  return result.ok ? revalidateDetail(result.data) : result;
}

export async function updateNote(id: string, input: NoteFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsedId = rowId("notes", id);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(noteSchema, input);
  if (!parsed.ok) return parsed;

  const result = await updateOwnChild("notes", user.id, parsedId.data, { body: parsed.data.body }, NOTE_NOT_FOUND);
  return result.ok ? revalidateDetail(result.data) : result;
}

export async function deleteNote(id: string): Promise<ActionResult> {
  return deleteChild("notes", id);
}

// Contacts (F6)

export async function createContact(applicationId: string, input: ContactFormValues): Promise<ActionResult> {
  await getCurrentUser();
  const parsedId = rowId("applications", applicationId);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(contactSchema, input);
  if (!parsed.ok) return parsed;

  const result = await insertChild("contacts", { application_id: parsedId.data, ...parsed.data }, APPLICATION_NOT_FOUND);
  return result.ok ? revalidateDetail(result.data) : result;
}

export async function updateContact(id: string, input: ContactFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsedId = rowId("contacts", id);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(contactSchema, input);
  if (!parsed.ok) return parsed;

  const result = await updateOwnChild("contacts", user.id, parsedId.data, parsed.data, CONTACT_NOT_FOUND);
  return result.ok ? revalidateDetail(result.data) : result;
}

/** Its interviewer links cascade; the interviews stay. */
export async function deleteContact(id: string): Promise<ActionResult> {
  return deleteChild("contacts", id);
}

// Interviews (F7)

/** The row's columns; the scheduled wall-clock time is read in the owner's time zone (D11). */
async function interviewColumns(input: InterviewInput) {
  const timeZone = await getTimeZone();
  return {
    kind: input.kind,
    scheduled_at: localDateTimeToInstant(input.scheduled_at, timeZone).toISOString(),
    duration_minutes: input.duration_minutes,
    location: input.location,
    interviewers: input.interviewers,
    outcome: input.outcome,
    notes: input.notes,
  };
}

/**
 * Makes the interview's picked contacts exactly `contactIds`. The composite foreign keys reject a
 * contact from another application or user (23503).
 */
async function syncInterviewers(userId: string, row: ChildRow, contactIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("interview_contacts")
    .select("contact_id")
    .eq("interview_id", row.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: writeErrorMessage(error) };

  const current = links.map((link) => link.contact_id);
  const removed = current.filter((id) => !contactIds.includes(id));
  const added = contactIds.filter((id) => !current.includes(id));

  if (removed.length > 0) {
    const { error: deleteError } = await supabase
      .from("interview_contacts")
      .delete()
      .eq("interview_id", row.id)
      .eq("user_id", userId)
      .in("contact_id", removed);
    if (deleteError) return { ok: false, error: writeErrorMessage(deleteError) };
  }
  if (added.length > 0) {
    const { error: insertError } = await supabase
      .from("interview_contacts")
      .insert(added.map((contact_id) => ({ application_id: row.application_id, interview_id: row.id, contact_id })));
    if (insertError) {
      return { ok: false, error: insertError.code === "23503" ? PICKED_CONTACT_GONE : writeErrorMessage(insertError) };
    }
  }
  return { ok: true, data: undefined };
}

/** F7: true when this is the application's first interview and it's in Applied or Screening. */
async function shouldSuggestInterviewing(userId: string, applicationId: string): Promise<boolean> {
  const supabase = await createClient();
  const [application, interviews] = await Promise.all([
    supabase.from("applications").select("status").eq("id", applicationId).eq("user_id", userId).maybeSingle(),
    supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("application_id", applicationId)
      .eq("user_id", userId),
  ]);
  const status = application.data?.status;
  return status !== undefined && isStatus(status) && suggestsInterviewing(status, interviews.count ?? 0);
}

export async function createInterview(
  applicationId: string,
  input: InterviewFormValues,
): Promise<ActionResult<{ suggestInterviewing: boolean }>> {
  const user = await getCurrentUser();
  const parsedId = rowId("applications", applicationId);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(interviewSchema, input);
  if (!parsed.ok) return parsed;

  const result = await insertChild(
    "interviews",
    { application_id: parsedId.data, ...(await interviewColumns(parsed.data)) },
    APPLICATION_NOT_FOUND,
  );
  if (!result.ok) return result;

  const synced = await syncInterviewers(user.id, result.data, parsed.data.contact_ids);
  if (!synced.ok) {
    // Don't leave a round without the interviewers the owner picked.
    await deleteOwnChild("interviews", user.id, result.data.id, INTERVIEW_NOT_FOUND);
    return synced;
  }

  revalidateDetail(result.data);
  return { ok: true, data: { suggestInterviewing: await shouldSuggestInterviewing(user.id, parsedId.data) } };
}

export async function updateInterview(id: string, input: InterviewFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsedId = rowId("interviews", id);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(interviewSchema, input);
  if (!parsed.ok) return parsed;

  const result = await updateOwnChild(
    "interviews",
    user.id,
    parsedId.data,
    await interviewColumns(parsed.data),
    INTERVIEW_NOT_FOUND,
  );
  if (!result.ok) return result;

  const synced = await syncInterviewers(user.id, result.data, parsed.data.contact_ids);
  revalidateDetail(result.data);
  return synced;
}

export async function deleteInterview(id: string): Promise<ActionResult> {
  return deleteChild("interviews", id);
}

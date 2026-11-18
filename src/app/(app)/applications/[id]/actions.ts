"use server";

import { z } from "zod";

import { type ActionResult, parseOr } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { writeErrorMessage } from "@/lib/db-errors";
import { localDateTimeToInstant } from "@/lib/dates";
import {
  type ChildRow,
  type ChildTable,
  deleteOwnChild,
  insertChild,
  NOT_FOUND,
  type OwnedTable,
  updateOwnChild,
} from "@/lib/owned-rows";
import { getTimeZone } from "@/lib/profile";
import { revalidateApplicationChild } from "@/lib/revalidate";
import { type ContactFormValues, contactSchema } from "@/lib/schemas/contact";
import { type InterviewFormValues, type InterviewInput, interviewSchema } from "@/lib/schemas/interview";
import { type NoteFormValues, noteSchema } from "@/lib/schemas/note";
import { suggestsInterviewing } from "@/lib/status";
import { storedStatus } from "@/lib/stored";
import { createClient } from "@/lib/supabase/server";

const PICKED_CONTACT_GONE = "One of the picked interviewers is no longer a contact here. Reload and try again.";

type Request<T> = { userId: string; id: string; values: T };

async function parseId(table: OwnedTable, id: unknown): Promise<ActionResult<{ userId: string; id: string }>> {
  const user = await getCurrentUser();
  const parsedId = parseOr(z.uuid({ error: NOT_FOUND[table] }), id);
  return parsedId.ok ? { ok: true, data: { userId: user.id, id: parsedId.data } } : parsedId;
}

/** `id` is the row's for an edit, the parent application's for an add. */
async function parseRequest<S extends z.ZodType>(
  table: OwnedTable,
  id: unknown,
  schema: S,
  input: unknown,
): Promise<ActionResult<Request<z.output<S>>>> {
  const parsedId = await parseId(table, id);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(schema, input);
  return parsed.ok ? { ok: true, data: { ...parsedId.data, values: parsed.data } } : parsed;
}

async function deleteChild(table: ChildTable, id: string): Promise<ActionResult> {
  const request = await parseId(table, id);
  if (!request.ok) return request;
  const result = await deleteOwnChild({ table, ...request.data });
  if (!result.ok) return result;
  revalidateApplicationChild(table, result.data.application_id);
  return { ok: true, data: undefined };
}

export async function createNote(applicationId: string, input: NoteFormValues): Promise<ActionResult> {
  const request = await parseRequest("applications", applicationId, noteSchema, input);
  if (!request.ok) return request;
  const result = await insertChild("notes", { application_id: request.data.id, ...request.data.values });
  if (!result.ok) return result;
  revalidateApplicationChild("notes", result.data.application_id);
  return { ok: true, data: undefined };
}

export async function updateNote(id: string, input: NoteFormValues): Promise<ActionResult> {
  const request = await parseRequest("notes", id, noteSchema, input);
  if (!request.ok) return request;
  const { userId, values } = request.data;
  const result = await updateOwnChild({ table: "notes", userId, id: request.data.id, patch: values });
  if (!result.ok) return result;
  revalidateApplicationChild("notes", result.data.application_id);
  return { ok: true, data: undefined };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  return deleteChild("notes", id);
}

export async function createContact(applicationId: string, input: ContactFormValues): Promise<ActionResult> {
  const request = await parseRequest("applications", applicationId, contactSchema, input);
  if (!request.ok) return request;
  const result = await insertChild("contacts", { application_id: request.data.id, ...request.data.values });
  if (!result.ok) return result;
  revalidateApplicationChild("contacts", result.data.application_id);
  return { ok: true, data: undefined };
}

export async function updateContact(id: string, input: ContactFormValues): Promise<ActionResult> {
  const request = await parseRequest("contacts", id, contactSchema, input);
  if (!request.ok) return request;
  const { userId, values } = request.data;
  const result = await updateOwnChild({ table: "contacts", userId, id: request.data.id, patch: values });
  if (!result.ok) return result;
  revalidateApplicationChild("contacts", result.data.application_id);
  return { ok: true, data: undefined };
}

/** Its interviewer links cascade; the interviews stay. */
export async function deleteContact(id: string): Promise<ActionResult> {
  return deleteChild("contacts", id);
}

/** The scheduled wall-clock time is read in the owner's time zone (D11). */
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

/** The composite foreign keys reject a contact from another application or user (23503). */
function linkError(error: { code?: string }): { ok: false; error: string } {
  return { ok: false, error: error.code === "23503" ? PICKED_CONTACT_GONE : writeErrorMessage(error) };
}

function linkRows(row: ChildRow, contactIds: string[]) {
  return contactIds.map((contact_id) => ({ application_id: row.application_id, interview_id: row.id, contact_id }));
}

async function replaceInterviewers(userId: string, row: ChildRow, contactIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  let unpicked = supabase.from("interview_contacts").delete().eq("interview_id", row.id).eq("user_id", userId);
  if (contactIds.length > 0) unpicked = unpicked.not("contact_id", "in", `(${contactIds.join(",")})`);
  const { error: deleteError } = await unpicked;
  if (deleteError) return { ok: false, error: writeErrorMessage(deleteError) };
  if (contactIds.length === 0) return { ok: true, data: undefined };

  const { error } = await supabase
    .from("interview_contacts")
    .upsert(linkRows(row, contactIds), { onConflict: "user_id,interview_id,contact_id", ignoreDuplicates: true });
  return error ? linkError(error) : { ok: true, data: undefined };
}

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
  if (!application.data) return false;
  return suggestsInterviewing(storedStatus(application.data.status), interviews.count ?? 0);
}

export async function createInterview(
  applicationId: string,
  input: InterviewFormValues,
): Promise<ActionResult<{ suggestInterviewing: boolean }>> {
  const request = await parseRequest("applications", applicationId, interviewSchema, input);
  if (!request.ok) return request;
  const { userId, values } = request.data;

  const result = await insertChild("interviews", { application_id: request.data.id, ...(await interviewColumns(values)) });
  if (!result.ok) return result;

  if (values.contact_ids.length > 0) {
    const supabase = await createClient();
    const { error } = await supabase.from("interview_contacts").insert(linkRows(result.data, values.contact_ids));
    if (error) {
      // Don't keep a round without the interviewers the owner picked. If that delete fails too,
      // revalidate so the leftover round shows.
      const removed = await deleteOwnChild({ table: "interviews", userId, id: result.data.id });
      if (!removed.ok) revalidateApplicationChild("interviews", result.data.application_id);
      return linkError(error);
    }
  }

  revalidateApplicationChild("interviews", result.data.application_id);
  return { ok: true, data: { suggestInterviewing: await shouldSuggestInterviewing(userId, request.data.id) } };
}

/** Not atomic: if the interviewer change fails, the other field changes stay saved. */
export async function updateInterview(id: string, input: InterviewFormValues): Promise<ActionResult> {
  const request = await parseRequest("interviews", id, interviewSchema, input);
  if (!request.ok) return request;
  const { userId, values } = request.data;

  const result = await updateOwnChild({
    table: "interviews",
    userId,
    id: request.data.id,
    patch: await interviewColumns(values),
  });
  if (!result.ok) return result;

  const replaced = await replaceInterviewers(userId, result.data, values.contact_ids);
  revalidateApplicationChild("interviews", result.data.application_id);
  return replaced;
}

export async function deleteInterview(id: string): Promise<ActionResult> {
  return deleteChild("interviews", id);
}

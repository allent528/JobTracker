"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { APPLICATION_NOT_FOUND, APPLICATIONS_PATH, applicationPath, initialStatus } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { writeErrorMessage } from "@/lib/db-errors";
import {
  type ApplicationFormValues,
  applicationIdSchema,
  applicationSchema,
  type ArchiveInput,
  archiveSchema,
  type StatusChangeInput,
  statusChangeSchema,
} from "@/lib/schemas/application";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database.types";

const INVALID_INPUT = "Check the form and try again.";

function parseOr<S extends z.ZodType>(schema: S, input: unknown): ActionResult<z.output<S>> {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };
}

/** An RLS-filtered update or delete returns no row rather than an error: that's "not found". */
function ownedRowResult({
  data,
  error,
}: {
  data: { id: string } | null;
  error: PostgrestError | null;
}): ActionResult<string> {
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (!data) return { ok: false, error: APPLICATION_NOT_FOUND };
  return { ok: true, data: data.id };
}

async function updateOwnApplication(
  userId: string,
  id: string,
  patch: TablesUpdate<"applications">,
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  return ownedRowResult(
    await supabase
      .from("applications")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle(),
  );
}

async function deleteOwnApplication(userId: string, id: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  return ownedRowResult(
    await supabase.from("applications").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle(),
  );
}

function revalidateApplication(id: string) {
  revalidatePath(APPLICATIONS_PATH);
  revalidatePath(applicationPath(id));
}

export async function createApplication(input: ApplicationFormValues): Promise<ActionResult<never>> {
  await getCurrentUser();
  const parsed = parseOr(applicationSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .insert({ ...parsed.data, status: initialStatus(parsed.data.date_applied) })
    .select("id")
    .single();
  if (error) return { ok: false, error: writeErrorMessage(error) };

  revalidatePath(APPLICATIONS_PATH);
  redirect(applicationPath(data.id));
}

/** Content columns only; status changes go through changeStatus. */
export async function updateApplication(
  id: string,
  input: ApplicationFormValues,
): Promise<ActionResult<never>> {
  const user = await getCurrentUser();
  const parsedId = parseOr(applicationIdSchema, id);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(applicationSchema, input);
  if (!parsed.ok) return parsed;

  const result = await updateOwnApplication(user.id, parsedId.data, parsed.data);
  if (!result.ok) return result;

  revalidateApplication(result.data);
  redirect(applicationPath(result.data));
}

/** Any status to any other (D6); the database trigger records the change (D5). */
export async function changeStatus(input: StatusChangeInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = parseOr(statusChangeSchema, input);
  if (!parsed.ok) return parsed;

  const result = await updateOwnApplication(user.id, parsed.data.id, { status: parsed.data.status });
  if (!result.ok) return result;

  revalidateApplication(result.data);
  return { ok: true, data: undefined };
}

export async function setArchived(input: ArchiveInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = parseOr(archiveSchema, input);
  if (!parsed.ok) return parsed;

  const archivedAt = parsed.data.archived ? new Date().toISOString() : null;
  const result = await updateOwnApplication(user.id, parsed.data.id, { archived_at: archivedAt });
  if (!result.ok) return result;

  revalidateApplication(result.data);
  return { ok: true, data: undefined };
}

/** Notes, contacts, interviews and history cascade in the database. */
export async function deleteApplication(id: string): Promise<ActionResult<never>> {
  const user = await getCurrentUser();
  const parsedId = parseOr(applicationIdSchema, id);
  if (!parsedId.ok) return parsedId;

  const result = await deleteOwnApplication(user.id, parsedId.data);
  if (!result.ok) return result;

  revalidatePath(APPLICATIONS_PATH);
  redirect(APPLICATIONS_PATH);
}

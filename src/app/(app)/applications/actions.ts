"use server";

import { redirect } from "next/navigation";

import { type ActionResult, parseOr } from "@/lib/action-result";
import { APPLICATIONS_PATH, applicationPath, initialStatus } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { writeErrorMessage } from "@/lib/db-errors";
import { revalidateApplication, revalidatePipeline } from "@/lib/revalidate";
import { deleteOwnApplication, updateOwnApplication } from "@/lib/owned-rows";
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

  revalidatePipeline();
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

  revalidatePipeline();
  redirect(APPLICATIONS_PATH);
}

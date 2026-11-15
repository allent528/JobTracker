"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { applicationPath, initialStatus } from "@/lib/applications";
import { HOME_PATH } from "@/lib/auth-routes";
import { getCurrentUser } from "@/lib/auth";
import { NOT_FOUND_MESSAGE, writeErrorMessage } from "@/lib/db-errors";
import {
  type ApplicationFormValues,
  applicationIdSchema,
  applicationSchema,
  type StatusChangeInput,
  statusChangeSchema,
} from "@/lib/schemas/application";
import { createClient } from "@/lib/supabase/server";

const INVALID_INPUT = "Check the form and try again.";

function revalidateApplication(id: string) {
  revalidatePath(HOME_PATH);
  revalidatePath(applicationPath(id));
}

/** F2: creates an application in `saved`, or `applied` when a date applied is set, then opens it. */
export async function createApplication(input: ApplicationFormValues): Promise<ActionResult<never>> {
  await getCurrentUser();
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .insert({ ...parsed.data, status: initialStatus(parsed.data.date_applied) })
    .select("id")
    .single();
  if (error) return { ok: false, error: writeErrorMessage(error) };

  revalidatePath(HOME_PATH);
  redirect(applicationPath(data.id));
}

/** F2: saves the edit form (content columns only; status changes go through changeStatus). */
export async function updateApplication(
  id: string,
  input: ApplicationFormValues,
): Promise<ActionResult<never>> {
  const user = await getCurrentUser();
  const parsedId = applicationIdSchema.safeParse(id);
  const parsed = applicationSchema.safeParse(input);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND_MESSAGE };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update(parsed.data)
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (!data) return { ok: false, error: NOT_FOUND_MESSAGE };

  revalidateApplication(data.id);
  redirect(applicationPath(data.id));
}

/** F4: any status to any other (D6). The database trigger records the change in status_events (D5). */
export async function changeStatus(input: StatusChangeInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (!data) return { ok: false, error: NOT_FOUND_MESSAGE };

  revalidateApplication(data.id);
  return { ok: true, data: undefined };
}

/** D10: archive hides an application from lists by default; unarchive brings it back. */
export async function setArchived(id: string, archived: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsedId = applicationIdSchema.safeParse(id);
  if (!parsedId.success || typeof archived !== "boolean") return { ok: false, error: NOT_FOUND_MESSAGE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (!data) return { ok: false, error: NOT_FOUND_MESSAGE };

  revalidateApplication(data.id);
  return { ok: true, data: undefined };
}

/** F2 / D10: hard delete; notes, contacts, interviews and history cascade in the database. */
export async function deleteApplication(id: string): Promise<ActionResult<never>> {
  const user = await getCurrentUser();
  const parsedId = applicationIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND_MESSAGE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (!data) return { ok: false, error: NOT_FOUND_MESSAGE };

  revalidateApplication(data.id);
  redirect(HOME_PATH);
}

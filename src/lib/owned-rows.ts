import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import type { ActionResult } from "@/lib/action-result";
import { APPLICATION_NOT_FOUND } from "@/lib/applications";
import { writeErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

// Writes to rows the signed-in user owns, for Server Actions. Updates and deletes filter by
// user_id on top of RLS; an RLS-filtered update or delete returns no row rather than an error,
// which becomes `notFound`. Callers pass only granted content columns.

/** Tables whose rows belong to one application. */
export type ChildTable = "notes" | "contacts" | "interviews";

/** What a child write returns: enough to revalidate the application's page. */
export type ChildRow = { id: string; application_id: string };

type WriteResult<R> = { data: R | null; error: PostgrestError | null };

/**
 * supabase-js can't type `.from(table)` for a union of tables, so the builder is typed as one of
 * them. Safe: callers' rows are already checked against `TablesInsert<T>` / `TablesUpdate<T>`,
 * and every child table has the id, user_id and application_id columns used here.
 */
async function childBuilder(table: ChildTable) {
  const supabase = await createClient();
  return supabase.from(table as "notes");
}

function ownedRowResult<R>({ data, error }: WriteResult<R>, notFound: string): ActionResult<R> {
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (data === null) return { ok: false, error: notFound };
  return { ok: true, data };
}

export async function updateOwnApplication(
  userId: string,
  id: string,
  patch: TablesUpdate<"applications">,
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const result = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  return ownedRowResult({ data: result.data?.id ?? null, error: result.error }, APPLICATION_NOT_FOUND);
}

export async function deleteOwnApplication(userId: string, id: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const result = await supabase.from("applications").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  return ownedRowResult({ data: result.data?.id ?? null, error: result.error }, APPLICATION_NOT_FOUND);
}

/**
 * A parent application that isn't the user's fails the composite foreign key (23503), so it can't
 * be attached to; that error maps to `notFound` as well.
 */
export async function insertChild<T extends ChildTable>(
  table: T,
  row: TablesInsert<T>,
  notFound: string,
): Promise<ActionResult<ChildRow>> {
  const result: WriteResult<ChildRow> = await (await childBuilder(table))
    .insert(row as TablesInsert<"notes">)
    .select("id, application_id")
    .single();
  if (result.error?.code === "23503") return { ok: false, error: notFound };
  return ownedRowResult(result, notFound);
}

export async function updateOwnChild<T extends ChildTable>(
  table: T,
  userId: string,
  id: string,
  patch: TablesUpdate<T>,
  notFound: string,
): Promise<ActionResult<ChildRow>> {
  const result: WriteResult<ChildRow> = await (await childBuilder(table))
    .update(patch as TablesUpdate<"notes">)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, application_id")
    .maybeSingle();
  return ownedRowResult(result, notFound);
}

export async function deleteOwnChild(
  table: ChildTable,
  userId: string,
  id: string,
  notFound: string,
): Promise<ActionResult<ChildRow>> {
  const result: WriteResult<ChildRow> = await (await childBuilder(table))
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, application_id")
    .maybeSingle();
  return ownedRowResult(result, notFound);
}

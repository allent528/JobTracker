import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import type { ActionResult } from "@/lib/action-result";
import { APPLICATION_NOT_FOUND } from "@/lib/applications";
import { writeErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

// Updates and deletes filter by user_id on top of RLS. An RLS-filtered update or delete returns no
// row rather than an error, which becomes the table's not-found message.

export type OwnedTable = "applications" | "notes" | "contacts" | "interviews";
export type ChildTable = Exclude<OwnedTable, "applications">;

export const NOT_FOUND = {
  applications: APPLICATION_NOT_FOUND,
  notes: "That note no longer exists.",
  contacts: "That contact no longer exists.",
  interviews: "That interview no longer exists.",
} as const satisfies Record<OwnedTable, string>;

/** Enough to revalidate the application's page. */
export type ChildRow = { id: string; application_id: string };

// Fails to compile if a child table loses a column the helpers below select or filter on.
type HasChildColumns<T extends ChildTable> = Tables<T> extends ChildRow & { user_id: string } ? true : never;
const _childColumns: { [T in ChildTable]: HasChildColumns<T> } = { notes: true, contacts: true, interviews: true };
void _childColumns;

type WriteResult<R> = { data: R | null; error: PostgrestError | null };

function ownedRowResult<R>({ data, error }: WriteResult<R>, table: OwnedTable): ActionResult<R> {
  if (error) return { ok: false, error: writeErrorMessage(error) };
  if (data === null) return { ok: false, error: NOT_FOUND[table] };
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
  return ownedRowResult({ data: result.data?.id ?? null, error: result.error }, "applications");
}

export async function deleteOwnApplication(userId: string, id: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const result = await supabase.from("applications").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  return ownedRowResult({ data: result.data?.id ?? null, error: result.error }, "applications");
}

/**
 * supabase-js can't type `.from()` over a union of table names. The public helpers check the row
 * against `TablesInsert<T>` / `TablesUpdate<T>`; inside, the builder is typed as one child table.
 */
async function childBuilder(table: ChildTable) {
  const supabase = await createClient();
  return supabase.from(table as "notes");
}

/** A parent that isn't the user's fails the composite foreign key (23503): "application not found". */
export async function insertChild<T extends ChildTable>(table: T, row: TablesInsert<T>): Promise<ActionResult<ChildRow>> {
  const result: WriteResult<ChildRow> = await (await childBuilder(table))
    .insert(row as TablesInsert<"notes">)
    .select("id, application_id")
    .single();
  if (result.error?.code === "23503") return { ok: false, error: NOT_FOUND.applications };
  return ownedRowResult(result, table);
}

export async function updateOwnChild<T extends ChildTable>({
  table,
  userId,
  id,
  patch,
}: {
  table: T;
  userId: string;
  id: string;
  patch: TablesUpdate<T>;
}): Promise<ActionResult<ChildRow>> {
  const result: WriteResult<ChildRow> = await (await childBuilder(table))
    .update(patch as TablesUpdate<"notes">)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, application_id")
    .maybeSingle();
  return ownedRowResult(result, table);
}

export async function deleteOwnChild({
  table,
  userId,
  id,
}: {
  table: ChildTable;
  userId: string;
  id: string;
}): Promise<ActionResult<ChildRow>> {
  const result: WriteResult<ChildRow> = await (await childBuilder(table))
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, application_id")
    .maybeSingle();
  return ownedRowResult(result, table);
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DateOnly } from "@/lib/dates";
import type { DueFollowUp } from "@/lib/reminders";
import { storedStatus } from "@/lib/stored";
import type { Database } from "@/types/database.types";

// Outside application-queries.ts (server-only) so the local-stack suite can run the real query.

/** Follow-ups dated before `untilDay` (no lower bound) on unarchived applications, soonest first. */
export function selectDueFollowUps(supabase: SupabaseClient<Database>, userId: string, untilDay: DateOnly) {
  return supabase
    .from("applications")
    .select("id, company, role_title, status, next_follow_up_on, follow_up_note")
    .eq("user_id", userId)
    .is("archived_at", null)
    .not("next_follow_up_on", "is", null)
    .lt("next_follow_up_on", untilDay)
    .order("next_follow_up_on");
}

type FollowUpRow = NonNullable<Awaited<ReturnType<typeof selectDueFollowUps>>["data"]>[number];

export function toDueFollowUps(rows: FollowUpRow[]): DueFollowUp[] {
  return rows.flatMap(({ next_follow_up_on, status, ...row }) =>
    next_follow_up_on === null ? [] : [{ ...row, status: storedStatus(status), next_follow_up_on }],
  );
}

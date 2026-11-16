import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkMode } from "@/lib/closed-sets";
import { type DateOnly, dateInTimeZone, daysBetween } from "@/lib/dates";
import type { PipelineItem } from "@/lib/pipeline";
import type { Status } from "@/lib/status";
import type { Database } from "@/types/database.types";

// Kept apart from application-queries.ts (server-only) so the local-stack suite can run the real query.

const PIPELINE_COLUMNS =
  "id, company, role_title, status, work_mode, date_applied, next_follow_up_on, archived_at, created_at, updated_at, status_events(changed_at)" as const;

/** Every application of `userId`, archived included, each with only its newest status event. */
export function selectPipeline(supabase: SupabaseClient<Database>, userId: string) {
  // PostgREST applies an embedded order and limit per parent row, so this stays one query.
  return supabase
    .from("applications")
    .select(PIPELINE_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("changed_at", { referencedTable: "status_events", ascending: false })
    .limit(1, { referencedTable: "status_events" });
}

type PipelineRow = NonNullable<Awaited<ReturnType<typeof selectPipeline>>["data"]>[number];

// The casts are the narrowing described in application-queries.ts (check constraints keep them safe).
export function toPipelineItems(rows: PipelineRow[], timeZone: string, today: DateOnly): PipelineItem[] {
  return rows.map(({ status_events, created_at, status, work_mode, ...row }) => {
    const statusStartedAt = status_events[0]?.changed_at ?? created_at;
    return {
      ...row,
      status: status as Status,
      work_mode: work_mode as WorkMode | null,
      days_in_status: daysBetween(dateInTimeZone(statusStartedAt, timeZone), today),
    };
  });
}

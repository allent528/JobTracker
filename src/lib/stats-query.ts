import type { SupabaseClient } from "@supabase/supabase-js";

import type { DateOnly } from "@/lib/dates";
import { RESPONSE_RATE_STATUSES } from "@/lib/status";
import { type Stats, statsWindow, toResponseRate, toStageDurations, toStatusCounts, toWeekCounts } from "@/lib/stats";
import { storedStatus } from "@/lib/stored";
import type { Database } from "@/types/database.types";

// Kept apart from application-queries.ts (server-only) so the local-stack suite can run the real queries.

const LOAD_ERROR = "Couldn't load your stats.";

/** `today` is in the owner's time zone (D11). */
export async function selectStats(
  supabase: SupabaseClient<Database>,
  { today, includeArchived }: { today: DateOnly; includeArchived: boolean },
): Promise<Stats> {
  const range = statsWindow(today);
  const [statusCounts, perDay, response, durations] = await Promise.all([
    supabase.rpc("stats_status_counts", { include_archived: includeArchived }),
    supabase.rpc("stats_applied_per_day", {
      from_day: range.fromDay,
      until_day: range.untilDay,
      include_archived: includeArchived,
    }),
    supabase.rpc("stats_response_counts", {
      reached_statuses: [...RESPONSE_RATE_STATUSES.reached],
      responded_statuses: [...RESPONSE_RATE_STATUSES.responded],
      include_archived: includeArchived,
    }),
    supabase.rpc("stats_stage_durations", { include_archived: includeArchived }),
  ]);
  if (statusCounts.error || perDay.error || response.error || durations.error) throw new Error(LOAD_ERROR);
  const [responseRow] = response.data;
  if (!responseRow) throw new Error(LOAD_ERROR);

  return {
    statusCounts: toStatusCounts(
      statusCounts.data.map((row) => ({ status: storedStatus(row.status), applications: row.applications })),
    ),
    fromDay: range.fromDay,
    weeks: toWeekCounts(perDay.data, range.weekStarts),
    responseRate: toResponseRate(responseRow),
    stageDurations: toStageDurations(
      durations.data.map((row) => ({ status: storedStatus(row.status), stays: row.stays, averageDays: row.average_days })),
    ),
  };
}

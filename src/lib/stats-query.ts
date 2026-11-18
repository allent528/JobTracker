import type { SupabaseClient } from "@supabase/supabase-js";

import type { DateOnly } from "@/lib/dates";
import { RESPONSE_RATE_STATUSES } from "@/lib/status";
import { type Stats, statsWindow, toResponseRate, toStageDurations, toStatusCounts, toWeekCounts } from "@/lib/stats";
import { storedStatus } from "@/lib/stored";
import type { Database } from "@/types/database.types";

// Kept apart from application-queries.ts (server-only) so the local-stack suite can run the real
// queries. The SQL functions filter by auth.uid() themselves and run with the caller's RLS.

/** Every F9 stat for the signed-in user. `today` is in the owner's time zone (D11). */
export async function selectStats(
  supabase: SupabaseClient<Database>,
  { today, includeArchived }: { today: DateOnly; includeArchived: boolean },
): Promise<Stats> {
  const window = statsWindow(today);
  const include_archived = includeArchived;
  const [statusCounts, perDay, response, durations] = await Promise.all([
    supabase.rpc("stats_status_counts", { include_archived }),
    supabase.rpc("stats_applied_per_day", { from_day: window.fromDay, until_day: window.untilDay, include_archived }),
    supabase.rpc("stats_response_counts", {
      reached_statuses: [...RESPONSE_RATE_STATUSES.reached],
      responded_statuses: [...RESPONSE_RATE_STATUSES.responded],
      include_archived,
    }),
    supabase.rpc("stats_stage_durations", { include_archived }),
  ]);
  if (statusCounts.error || perDay.error || response.error || durations.error) {
    throw new Error("Couldn't load your stats.");
  }

  return {
    statusCounts: toStatusCounts(statusCounts.data.map((row) => ({ ...row, status: storedStatus(row.status) }))),
    weeks: toWeekCounts(perDay.data, window.weekStarts),
    responseRate: toResponseRate(response.data[0]),
    stageDurations: toStageDurations(durations.data.map((row) => ({ ...row, status: storedStatus(row.status) }))),
  };
}

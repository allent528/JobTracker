import type { SupabaseClient } from "@supabase/supabase-js";

import { type InterviewKind, PENDING_OUTCOME } from "@/lib/closed-sets";
import type { Status } from "@/lib/status";
import { storedInterviewKind, storedStatus } from "@/lib/stored";
import type { Database } from "@/types/database.types";

// Outside application-queries.ts (server-only) so the local-stack suite can run the real query.

export type UpcomingInterview = {
  id: string;
  kind: InterviewKind;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  application: { id: string; company: string; role_title: string; status: Status };
};

/**
 * Pending rounds in [from, until) (ISO instants) on unarchived applications, soonest first. Without
 * `from`, every earlier pending round is included (F8 shows those as overdue).
 */
export function selectUpcomingInterviews(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { from?: string; until: string },
) {
  const query = supabase
    .from("interviews")
    .select(
      "id, kind, scheduled_at, duration_minutes, location, applications!inner(id, company, role_title, status, archived_at)",
    )
    .eq("user_id", userId)
    .eq("outcome", PENDING_OUTCOME)
    .lt("scheduled_at", range.until)
    .is("applications.archived_at", null);
  return (range.from === undefined ? query : query.gte("scheduled_at", range.from)).order("scheduled_at");
}

type UpcomingRow = NonNullable<Awaited<ReturnType<typeof selectUpcomingInterviews>>["data"]>[number];

export function toUpcomingInterviews(rows: UpcomingRow[]): UpcomingInterview[] {
  return rows.map(({ applications, kind, ...row }) => ({
    ...row,
    kind: storedInterviewKind(kind),
    application: {
      id: applications.id,
      company: applications.company,
      role_title: applications.role_title,
      status: storedStatus(applications.status),
    },
  }));
}

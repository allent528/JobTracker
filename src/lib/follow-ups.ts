import type { DateOnly } from "@/lib/dates";

export type FollowUpState = "overdue" | "today" | "upcoming";

export function followUpState(nextFollowUpOn: DateOnly | null, today: DateOnly): FollowUpState | null {
  if (!nextFollowUpOn) return null;
  if (nextFollowUpOn < today) return "overdue";
  return nextFollowUpOn === today ? "today" : "upcoming";
}

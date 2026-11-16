import { type DateOnly, dateInTimeZone } from "@/lib/dates";

export type FollowUpState = "overdue" | "today" | "upcoming";

export function followUpState(nextFollowUpOn: DateOnly | null, today: DateOnly): FollowUpState | null {
  if (!nextFollowUpOn) return null;
  if (nextFollowUpOn < today) return "overdue";
  return nextFollowUpOn === today ? "today" : "upcoming";
}

/** Same states as a follow-up, by the interview's calendar day in `timeZone`. */
export function interviewDueState(scheduledAt: string, timeZone: string, today: DateOnly): FollowUpState {
  const day = dateInTimeZone(scheduledAt, timeZone);
  if (day < today) return "overdue";
  return day === today ? "today" : "upcoming";
}

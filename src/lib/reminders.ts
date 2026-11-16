import { addDays, type DateOnly, dateInTimeZone, daysBetween } from "@/lib/dates";
import type { UpcomingInterview } from "@/lib/interview-query";
import type { Status } from "@/lib/status";

// F8: the home page's Overdue, Today and Next 7 days lists, in the owner's time zone (D11).

/** Days after today that "Next 7 days" covers (tomorrow through today + 7). */
export const REMINDER_WINDOW_DAYS = 7;

/** Marking a follow-up done suggests the next one this many days from today (F8). */
export const NEXT_FOLLOW_UP_DAYS = 7;

export type DueFollowUp = {
  id: string;
  company: string;
  role_title: string;
  status: Status;
  next_follow_up_on: DateOnly;
  follow_up_note: string | null;
};

export type Reminder =
  | { kind: "follow_up"; key: string; date: DateOnly; followUp: DueFollowUp }
  | { kind: "interview"; key: string; date: DateOnly; interview: UpcomingInterview };

export const REMINDER_BUCKETS = ["overdue", "today", "next7Days"] as const;
export type ReminderBucket = (typeof REMINDER_BUCKETS)[number];
export type ReminderBuckets = Record<ReminderBucket, Reminder[]>;

export const REMINDER_BUCKET_LABELS = {
  overdue: "Overdue",
  today: "Today",
  next7Days: "Next 7 days",
} as const satisfies Record<ReminderBucket, string>;

/**
 * What the home page loads: follow-ups dated up to `lastDay` (no lower bound, so every overdue one
 * shows), and pending interviews before the start of `untilDay` in the owner's zone.
 */
export function reminderWindow(today: DateOnly): { lastDay: DateOnly; untilDay: DateOnly } {
  return { lastDay: addDays(today, REMINDER_WINDOW_DAYS), untilDay: addDays(today, REMINDER_WINDOW_DAYS + 1) };
}

function bucketFor(date: DateOnly, today: DateOnly): ReminderBucket | null {
  if (date < today) return "overdue";
  if (date === today) return "today";
  return date <= reminderWindow(today).lastDay ? "next7Days" : null;
}

/** Same day: interviews first by time, then follow-ups by company and role. */
function compareReminders(a: Reminder, b: Reminder): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === "interview" ? -1 : 1;
  if (a.kind === "interview" && b.kind === "interview") {
    return a.interview.scheduled_at.localeCompare(b.interview.scheduled_at);
  }
  if (a.kind === "follow_up" && b.kind === "follow_up") {
    return (
      a.followUp.company.localeCompare(b.followUp.company) || a.followUp.role_title.localeCompare(b.followUp.role_title)
    );
  }
  return 0;
}

/**
 * Interviews fall on their calendar day in `timeZone`. Anything after the window is dropped, so the
 * result doesn't depend on how wide the query was.
 */
export function bucketReminders({
  followUps,
  interviews,
  today,
  timeZone,
}: {
  followUps: DueFollowUp[];
  interviews: UpcomingInterview[];
  today: DateOnly;
  timeZone: string;
}): ReminderBuckets {
  const reminders: Reminder[] = [
    ...followUps.map((followUp) => ({
      kind: "follow_up" as const,
      key: `follow_up:${followUp.id}`,
      date: followUp.next_follow_up_on,
      followUp,
    })),
    ...interviews.map((interview) => ({
      kind: "interview" as const,
      key: `interview:${interview.id}`,
      date: dateInTimeZone(interview.scheduled_at, timeZone),
      interview,
    })),
  ].sort(compareReminders);

  const buckets: ReminderBuckets = { overdue: [], today: [], next7Days: [] };
  for (const reminder of reminders) {
    const bucket = bucketFor(reminder.date, today);
    if (bucket) buckets[bucket].push(reminder);
  }
  return buckets;
}

/** "3 days overdue", "1 day overdue", "Today", "Tomorrow", "In 4 days". */
export function formatDueIn(date: DateOnly, today: DateOnly): string {
  const days = daysBetween(today, date);
  if (days < 0) return days === -1 ? "1 day overdue" : `${-days} days overdue`;
  if (days === 0) return "Today";
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

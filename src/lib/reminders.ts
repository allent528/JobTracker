import { addDays, type DateOnly, dateInTimeZone, daysBetween } from "@/lib/dates";
import { type FollowUpState, followUpState } from "@/lib/follow-ups";
import type { UpcomingInterview } from "@/lib/interview-query";
import type { Status } from "@/lib/status";

/** Days after today that the "upcoming" list covers. */
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

export const REMINDER_BUCKETS = ["overdue", "today", "upcoming"] as const satisfies readonly FollowUpState[];
export type ReminderBuckets = Record<FollowUpState, Reminder[]>;

/**
 * The home page loads days before `untilDay` (exclusive), with no lower bound so every overdue item
 * shows. Day windows are half-open `[from, until)` DateOnly ranges throughout.
 */
export function reminderWindow(today: DateOnly): { untilDay: DateOnly } {
  return { untilDay: addDays(today, REMINDER_WINDOW_DAYS + 1) };
}

function bucketFor(date: DateOnly, today: DateOnly, untilDay: DateOnly): FollowUpState | null {
  return date < untilDay ? followUpState(date, today) : null;
}

const KIND_RANK = { interview: 0, follow_up: 1 } as const satisfies Record<Reminder["kind"], number>;

function tiebreakKeys(reminder: Reminder): string[] {
  switch (reminder.kind) {
    case "interview":
      return [reminder.interview.scheduled_at];
    case "follow_up":
      return [reminder.followUp.company, reminder.followUp.role_title];
    default: {
      const unknown: never = reminder;
      throw new Error(`Unknown reminder: ${JSON.stringify(unknown)}`);
    }
  }
}

/** By day; on the same day, interviews by time before follow-ups by company and role. */
function compareReminders(a: Reminder, b: Reminder): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (rank !== 0) return rank;
  const [aKeys, bKeys] = [tiebreakKeys(a), tiebreakKeys(b)];
  for (let i = 0; i < aKeys.length; i++) {
    const order = aKeys[i].localeCompare(bKeys[i]);
    if (order !== 0) return order;
  }
  return 0;
}

/** Interviews fall on their calendar day in `timeZone`; anything from `untilDay` on is dropped. */
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

  const { untilDay } = reminderWindow(today);
  const buckets: ReminderBuckets = { overdue: [], today: [], upcoming: [] };
  for (const reminder of reminders) {
    const bucket = bucketFor(reminder.date, today, untilDay);
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

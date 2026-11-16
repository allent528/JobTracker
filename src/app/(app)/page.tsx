import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { listDueFollowUps, listUpcomingInterviews } from "@/lib/application-queries";
import { applicationPath } from "@/lib/applications";
import { SETTINGS_PATH } from "@/lib/auth-routes";
import { INTERVIEW_KIND_LABELS } from "@/lib/closed-sets";
import { addDays, type DateOnly, formatDate, formatDateTimeWithZone } from "@/lib/dates";
import { getTimeZone, getToday } from "@/lib/profile";
import {
  bucketReminders,
  formatDueIn,
  NEXT_FOLLOW_UP_DAYS,
  type Reminder,
  REMINDER_BUCKET_LABELS,
  REMINDER_BUCKETS,
  type ReminderBucket,
  reminderWindow,
} from "@/lib/reminders";
import { isHttpUrl } from "@/lib/schemas/fields";

import { FollowUpDoneButton } from "./follow-up-done";

export const metadata: Metadata = { title: "Home · JobTracker" };

const EMPTY_BUCKET = {
  overdue: "Nothing overdue.",
  today: "Nothing due today.",
  next7Days: "Nothing in the next 7 days.",
} as const satisfies Record<ReminderBucket, string>;

/** F8: follow-ups and pending interviews, Overdue / Today / Next 7 days in the owner's zone (D11). */
export default function HomePage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Reminders</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Reminders />
      </Suspense>
    </section>
  );
}

async function Reminders() {
  const [today, timeZone] = await Promise.all([getToday(), getTimeZone()]);
  const { lastDay, untilDay } = reminderWindow(today);
  const [followUps, interviews] = await Promise.all([
    listDueFollowUps(lastDay),
    listUpcomingInterviews({ until: untilDay }),
  ]);
  const buckets = bucketReminders({ followUps, interviews, today, timeZone });

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Today is {formatDate(today)} in {timeZone}.{" "}
        <Link href={SETTINGS_PATH} className="underline underline-offset-4 hover:text-foreground">
          Change time zone
        </Link>
      </p>
      {REMINDER_BUCKETS.map((bucket) => (
        <section key={bucket} aria-labelledby={`${bucket}-heading`} className="grid gap-3">
          <h2 id={`${bucket}-heading`} className="text-xl font-semibold">
            {REMINDER_BUCKET_LABELS[bucket]}{" "}
            <span className="ml-1 text-base font-normal text-muted-foreground">({buckets[bucket].length})</span>
          </h2>
          {buckets[bucket].length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{EMPTY_BUCKET[bucket]}</p>
          ) : (
            <ul className="grid gap-3">
              {buckets[bucket].map((reminder) => (
                <li key={reminder.key} className="rounded-lg border bg-card p-4 text-card-foreground">
                  <ReminderItem reminder={reminder} today={today} timeZone={timeZone} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function ApplicationLink({ id, company, role }: { id: string; company: string; role: string }) {
  return (
    <Link href={applicationPath(id)} className="font-medium break-words underline-offset-4 hover:underline">
      {company} <span className="text-muted-foreground">· {role}</span>
    </Link>
  );
}

function ReminderItem({ reminder, today, timeZone }: { reminder: Reminder; today: DateOnly; timeZone: string }) {
  if (reminder.kind === "follow_up") {
    const { followUp } = reminder;
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Follow-up</Badge>
          <StatusBadge status={followUp.status} />
        </div>
        <ApplicationLink id={followUp.id} company={followUp.company} role={followUp.role_title} />
        <p className="text-sm">
          {formatDate(followUp.next_follow_up_on)}
          <span className="text-muted-foreground"> · {formatDueIn(followUp.next_follow_up_on, today)}</span>
        </p>
        {followUp.follow_up_note && <p className="text-sm break-words whitespace-pre-wrap">{followUp.follow_up_note}</p>}
        <div>
          <FollowUpDoneButton
            applicationId={followUp.id}
            label={`${followUp.company}, ${followUp.role_title}`}
            note={followUp.follow_up_note}
            suggestedNext={addDays(today, NEXT_FOLLOW_UP_DAYS)}
          />
        </div>
      </div>
    );
  }

  const { interview } = reminder;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Interview</Badge>
        <span className="text-sm font-medium">{INTERVIEW_KIND_LABELS[interview.kind]}</span>
        <StatusBadge status={interview.application.status} />
      </div>
      <ApplicationLink
        id={interview.application.id}
        company={interview.application.company}
        role={interview.application.role_title}
      />
      <p className="text-sm">
        {formatDateTimeWithZone(interview.scheduled_at, timeZone)}
        {interview.duration_minutes !== null && (
          <span className="text-muted-foreground"> · {interview.duration_minutes} min</span>
        )}
      </p>
      {interview.location && (
        <p className="text-sm break-words">
          {isHttpUrl(interview.location) ? (
            <a
              href={interview.location}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {interview.location}
            </a>
          ) : (
            interview.location
          )}
        </p>
      )}
      {reminder.date < today && (
        <p className="text-sm text-muted-foreground">Outcome not recorded yet. Open the application to update it.</p>
      )}
    </div>
  );
}

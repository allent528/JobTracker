import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Empty } from "@/components/section-ui";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { listDueFollowUps, listUpcomingInterviews } from "@/lib/application-queries";
import { applicationPath } from "@/lib/applications";
import { SETTINGS_PATH } from "@/lib/auth-routes";
import { INTERVIEW_KIND_LABELS } from "@/lib/closed-sets";
import { addDays, type DateOnly, formatDate, formatDateTimeWithZone } from "@/lib/dates";
import type { FollowUpState } from "@/lib/follow-ups";
import { getTimeZone, getToday } from "@/lib/profile";
import type { UpcomingInterview } from "@/lib/interview-query";
import {
  bucketReminders,
  type DueFollowUp,
  formatDueIn,
  NEXT_FOLLOW_UP_DAYS,
  type Reminder,
  REMINDER_BUCKETS,
  REMINDER_WINDOW_DAYS,
  reminderWindow,
} from "@/lib/reminders";
import { isHttpUrl } from "@/lib/schemas/fields";
import { cn } from "@/lib/utils";

import { FollowUpDoneButton } from "./follow-up-done";

export const metadata: Metadata = { title: "Reminders · JobTracker" };

const BUCKET_COPY = {
  overdue: { label: "Overdue", empty: "Nothing overdue." },
  today: { label: "Today", empty: "Nothing due today." },
  upcoming: {
    label: `Next ${REMINDER_WINDOW_DAYS} days`,
    empty: `Nothing in the next ${REMINDER_WINDOW_DAYS} days.`,
  },
} as const satisfies Record<FollowUpState, { label: string; empty: string }>;

export default function HomePage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-1">
      <h1 className="text-title">Reminders</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Reminders />
      </Suspense>
    </section>
  );
}

async function Reminders() {
  const [today, timeZone] = await Promise.all([getToday(), getTimeZone()]);
  const { untilDay } = reminderWindow(today);
  const [followUps, interviews] = await Promise.all([listDueFollowUps(untilDay), listUpcomingInterviews(untilDay)]);
  const buckets = bucketReminders({ followUps, interviews, today, timeZone });

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Today is {formatDate(today)} in {timeZone}.{" "}
        <Link href={SETTINGS_PATH} className="underline underline-offset-4 hover:text-foreground">
          Change time zone
        </Link>
      </p>
      <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-8">
        {REMINDER_BUCKETS.map((bucket) => (
          <section key={bucket} aria-labelledby={`${bucket}-heading`} className="grid gap-3">
            <h2 id={`${bucket}-heading`} className="text-heading">
              {BUCKET_COPY[bucket].label}{" "}
              <span
                className={cn(
                  "ml-0.5 font-normal text-muted-foreground tabular-nums",
                  bucket === "overdue" && buckets[bucket].length > 0 && "text-destructive",
                )}
              >
                ({buckets[bucket].length})
              </span>
            </h2>
            {buckets[bucket].length === 0 ? (
              <Empty>{BUCKET_COPY[bucket].empty}</Empty>
            ) : (
              <ul className="divide-y rounded-lg border bg-card text-card-foreground">
                {buckets[bucket].map((reminder) => (
                  <li key={reminder.key} className="p-4">
                    <ReminderItem reminder={reminder} bucket={bucket} today={today} timeZone={timeZone} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
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

type ReminderItemProps = { reminder: Reminder; bucket: FollowUpState; today: DateOnly; timeZone: string };

function ReminderItem({ reminder, bucket, today, timeZone }: ReminderItemProps) {
  switch (reminder.kind) {
    case "follow_up":
      return <FollowUpItem followUp={reminder.followUp} today={today} />;
    case "interview":
      return <InterviewItem interview={reminder.interview} overdue={bucket === "overdue"} timeZone={timeZone} />;
    default: {
      const unknown: never = reminder;
      throw new Error(`Unknown reminder: ${JSON.stringify(unknown)}`);
    }
  }
}

function FollowUpItem({
  followUp,
  today,
}: {
  followUp: DueFollowUp;
  today: DateOnly;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Follow-up</Badge>
          <StatusBadge status={followUp.status} />
        </div>
        <ApplicationLink id={followUp.id} company={followUp.company} role={followUp.role_title} />
        <p className="text-sm tabular-nums">
          {formatDate(followUp.next_follow_up_on)}
          <span className="text-muted-foreground"> · {formatDueIn(followUp.next_follow_up_on, today)}</span>
        </p>
        {followUp.follow_up_note && <p className="text-sm break-words whitespace-pre-wrap">{followUp.follow_up_note}</p>}
      </div>
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

function InterviewItem({
  interview,
  overdue,
  timeZone,
}: {
  interview: UpcomingInterview;
  overdue: boolean;
  timeZone: string;
}) {
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
      <p className="text-sm tabular-nums">
        {formatDateTimeWithZone(interview.scheduled_at, timeZone)}
        {interview.duration_minutes !== null && (
          <span className="text-muted-foreground"> · {interview.duration_minutes} min</span>
        )}
      </p>
      {interview.location && (
        <p className="text-sm break-words">
          {isHttpUrl(interview.location) ? (
            <a href={interview.location} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {interview.location}
            </a>
          ) : (
            interview.location
          )}
        </p>
      )}
      {overdue && (
        <p className="text-sm text-muted-foreground">Outcome not recorded yet. Open the application to update it.</p>
      )}
    </div>
  );
}

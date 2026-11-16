import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getApplicationOrNotFound,
  getStatusHistory,
  listContacts,
  listInterviews,
  listNotes,
} from "@/lib/application-queries";
import { APPLICATIONS_PATH, editApplicationPath, formatSalaryRange } from "@/lib/applications";
import { WORK_MODE_LABELS } from "@/lib/closed-sets";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getTimeZone } from "@/lib/profile";

import { ArchiveButton, DeleteButton, StatusControl } from "./application-controls";
import { ContactsSection, HistorySection, InterviewsSection, NotesSection } from "./sections";

export const metadata: Metadata = { title: "Application · JobTracker" };

export default function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  return (
    <div className="grid max-w-5xl gap-6">
      <Link href={APPLICATIONS_PATH} className="text-sm font-medium underline underline-offset-4 justify-self-start">
        All applications
      </Link>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ApplicationDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ApplicationDetail({ params }: Pick<PageProps<"/applications/[id]">, "params">) {
  const { id } = await params;
  const app = await getApplicationOrNotFound(id);
  const [history, notes, contacts, interviews, timeZone] = await Promise.all([
    getStatusHistory(app.id),
    listNotes(app.id),
    listContacts(app.id),
    listInterviews(app.id),
    getTimeZone(),
  ]);
  const archived = app.archived_at !== null;

  const details: [label: string, value: React.ReactNode][] = [
    ["Job posting", app.job_url && (
      <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">
        {app.job_url}
      </a>
    )],
    ["Location", app.location],
    ["Work mode", app.work_mode && WORK_MODE_LABELS[app.work_mode]],
    ["Salary", formatSalaryRange(app.salary_min, app.salary_max, app.salary_currency)],
    ["Source", app.source],
    ["Date applied", app.date_applied && formatDate(app.date_applied)],
    ["Next follow-up", app.next_follow_up_on && formatDate(app.next_follow_up_on)],
    ["Follow-up note", app.follow_up_note],
    ["Last updated", formatDateTime(app.updated_at, timeZone)],
  ];

  return (
    <article className="grid gap-8">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={app.status} />
          {archived && <Badge variant="outline">Archived</Badge>}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight break-words">{app.company}</h1>
        <p className="text-lg break-words text-muted-foreground">{app.role_title}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={editApplicationPath(app.id)}>Edit</Link>
          </Button>
          <ArchiveButton id={app.id} archived={archived} />
          <DeleteButton id={app.id} company={app.company} roleTitle={app.role_title} />
        </div>
      </header>

      <section aria-labelledby="status-heading" className="grid gap-3 rounded-lg border p-4">
        <h2 id="status-heading" className="text-lg font-semibold">
          Status
        </h2>
        <StatusControl id={app.id} status={app.status} />
      </section>

      <section aria-labelledby="details-heading" className="grid gap-3">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="break-words">{value || <span className="text-muted-foreground">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      {app.description && (
        <section aria-labelledby="description-heading" className="grid gap-3">
          <h2 id="description-heading" className="text-lg font-semibold">
            Description
          </h2>
          <p className="break-words whitespace-pre-wrap">{app.description}</p>
        </section>
      )}

      <InterviewsSection applicationId={app.id} interviews={interviews} contacts={contacts} timeZone={timeZone} />
      <ContactsSection applicationId={app.id} contacts={contacts} />
      <NotesSection applicationId={app.id} notes={notes} timeZone={timeZone} />
      <HistorySection history={history} timeZone={timeZone} />
    </article>
  );
}

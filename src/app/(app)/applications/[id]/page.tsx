import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PanelSection } from "@/components/section-ui";
import { StageRule } from "@/components/stage-rule";
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
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6">
      <Link
        href={APPLICATIONS_PATH}
        className="-ml-1 inline-flex items-center gap-1 justify-self-start rounded-sm pr-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
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
    <article className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusBadge status={app.status} />
          {archived && <Badge variant="outline">Archived</Badge>}
          <StageRule status={app.status} className="w-32" />
        </div>
        <div className="grid gap-1">
          <h1 className="text-title break-words">{app.company}</h1>
          <p className="text-lg break-words text-muted-foreground">{app.role_title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={editApplicationPath(app.id)}>Edit</Link>
          </Button>
          <ArchiveButton id={app.id} archived={archived} />
          <DeleteButton id={app.id} company={app.company} roleTitle={app.role_title} />
        </div>
      </header>

      <PanelSection id="status" title="Status">
        <StatusControl id={app.id} status={app.status} />
      </PanelSection>

      <section aria-labelledby="details-heading" className="grid gap-3">
        <h2 id="details-heading" className="text-heading">
          Details
        </h2>
        <dl className="divide-y rounded-lg border bg-card">
          {details.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <dt className="text-sm text-muted-foreground sm:pt-px">{label}</dt>
              <dd className="break-words">{value || <span className="text-muted-foreground">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      {app.description && (
        <section aria-labelledby="description-heading" className="grid gap-3">
          <h2 id="description-heading" className="text-heading">
            Description
          </h2>
          <p className="break-words whitespace-pre-wrap">{app.description}</p>
        </section>
      )}

      <InterviewsSection applicationId={app.id} status={app.status} interviews={interviews} contacts={contacts} timeZone={timeZone} />
      <ContactsSection applicationId={app.id} contacts={contacts} />
      <NotesSection applicationId={app.id} notes={notes} timeZone={timeZone} />
      <HistorySection history={history} timeZone={timeZone} />
    </article>
  );
}

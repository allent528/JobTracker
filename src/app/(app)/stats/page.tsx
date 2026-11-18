import type { Metadata } from "next";
import { Suspense } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStats } from "@/lib/application-queries";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { STATUS_META } from "@/lib/status";
import {
  formatDays,
  INCLUDE_ARCHIVED_PARAM,
  parseIncludeArchived,
  type ResponseRate,
  type StageDuration,
  STATS_WEEKS,
  type StatusCount,
  type StatusCounts,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

import { IncludeArchivedToggle } from "./include-archived-toggle";
import { WeeklyChart } from "./weekly-chart";

export const metadata: Metadata = { title: "Stats · JobTracker" };

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <section className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Stats</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <StatsContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function StatsContent({ searchParams }: Pick<PageProps<"/stats">, "searchParams">) {
  const [params] = await Promise.all([searchParams, getCurrentUser()]);
  const includeArchived = parseIncludeArchived(params[INCLUDE_ARCHIVED_PARAM]);
  const stats = await getStats(includeArchived);

  return (
    <>
      <IncludeArchivedToggle checked={includeArchived} />
      {stats.statusCounts.total === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          {includeArchived
            ? "No applications to count yet."
            : "No applications to count yet. Archived applications count only when included."}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <StatSection id="status-counts" title="Applications by status">
            <StatusCountsTable counts={stats.statusCounts} />
          </StatSection>
          <StatSection id="response-rate" title="Response rate">
            <ResponseRateTile rate={stats.responseRate} />
          </StatSection>
          <StatSection id="weekly" title={`Applications per week (last ${STATS_WEEKS} weeks)`} className="lg:col-span-2">
            <p className="text-sm text-muted-foreground">
              By date applied, weeks starting Monday, from {formatDate(stats.weeks[0].weekStart)}.
            </p>
            <WeeklyChart weeks={stats.weeks} />
          </StatSection>
          <StatSection id="stage-durations" title="Average days in each stage" className="lg:col-span-2">
            <StageDurationsTable durations={stats.stageDurations} />
          </StatSection>
        </div>
      )}
    </>
  );
}

function StatSection({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn("grid min-w-0 content-start gap-3 rounded-lg border bg-card p-4 text-card-foreground", className)}
    >
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusCountsTable({ counts }: { counts: StatusCounts }) {
  const max = Math.max(1, ...counts.active.map((c) => c.applications), ...counts.closed.map((c) => c.applications));
  const group = (label: string, rows: StatusCount[]) => (
    <>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="rowgroup" colSpan={2} className="text-xs tracking-wide text-muted-foreground uppercase">
          {label}
        </TableHead>
      </TableRow>
      {rows.map(({ status, applications }) => (
        <TableRow key={status}>
          <TableHead scope="row" className="w-32 font-normal">
            <StatusBadge status={status} />
          </TableHead>
          <TableCell>
            <div className="flex items-center gap-3">
              <span className="w-8 text-right tabular-nums">{applications}</span>
              <span aria-hidden className="flex-1">
                <span
                  className="block h-2 rounded-sm bg-chart-2"
                  style={{ width: `${(applications / max) * 100}%` }}
                />
              </span>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <Table>
      <TableHeader className="sr-only">
        <TableRow>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Applications</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {group("Active", counts.active)}
        {group("Closed", counts.closed)}
        <TableRow className="hover:bg-transparent">
          <TableHead scope="row">Total</TableHead>
          <TableCell>
            <span className="inline-block w-8 text-right font-medium tabular-nums">{counts.total}</span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function ResponseRateTile({ rate }: { rate: ResponseRate }) {
  const applied = STATUS_META.applied.label;
  const screening = STATUS_META.screening.label;
  if (rate.percent === null) {
    return <p className="text-sm text-muted-foreground">No applications have reached {applied} yet.</p>;
  }
  return (
    <div className="grid gap-1">
      <p className="text-4xl font-semibold tabular-nums">{rate.percent}%</p>
      <p className="text-sm text-muted-foreground">
        {rate.responded} of {rate.reached} applications that reached {applied} got to {screening} or later.
      </p>
    </div>
  );
}

function StageDurationsTable({ durations }: { durations: StageDuration[] }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        From the status history. A stay counts once the application moves on, so its current stage isn&apos;t
        included.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Stage</TableHead>
            <TableHead scope="col" className="text-right">
              Average
            </TableHead>
            <TableHead scope="col" className="text-right">
              Stays counted
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {durations.map(({ status, stays, averageDays }) => (
            <TableRow key={status}>
              <TableHead scope="row" className="font-normal">
                <StatusBadge status={status} />
              </TableHead>
              <TableCell className="text-right tabular-nums">
                {averageDays === null ? <span className="text-muted-foreground">No data</span> : formatDays(averageDays)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{stays}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { Empty, PanelSection } from "@/components/section-ui";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStats } from "@/lib/application-queries";
import { formatDate } from "@/lib/dates";
import { RESPONSE_RATE_FROM, STATUS_META } from "@/lib/status";
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

import { STATS_MARK_COLOR } from "./chart-color";
import { IncludeArchivedToggle } from "./include-archived-toggle";
import { WeeklyChart } from "./weekly-chart";

export const metadata: Metadata = { title: "Stats · JobTracker" };

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <section className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-title">Stats</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <StatsContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function StatsContent({ searchParams }: Pick<PageProps<"/stats">, "searchParams">) {
  const includeArchived = parseIncludeArchived((await searchParams)[INCLUDE_ARCHIVED_PARAM]);
  const stats = await getStats(includeArchived);

  return (
    <>
      <IncludeArchivedToggle checked={includeArchived} />
      {stats.statusCounts.total === 0 ? (
        <Empty size="page">No applications to count yet.</Empty>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:gap-6">
          <PanelSection id="response-rate" title="Response rate" className="lg:col-span-2">
            <ResponseRateTile rate={stats.responseRate} />
          </PanelSection>
          <PanelSection id="status-counts" title="Applications by status">
            <StatusCountsTable counts={stats.statusCounts} />
          </PanelSection>
          <PanelSection id="stage-durations" title="Average days in each stage">
            <StageDurationsTable durations={stats.stageDurations} />
          </PanelSection>
          <PanelSection id="weekly" title={`Applications per week (last ${STATS_WEEKS} weeks)`} className="lg:col-span-2">
            <p className="text-sm text-muted-foreground">
              By date applied, weeks starting Monday, from {formatDate(stats.fromDay)}.
            </p>
            <WeeklyChart weeks={stats.weeks} />
          </PanelSection>
        </div>
      )}
    </>
  );
}

function StatusCountsTable({ counts }: { counts: StatusCounts }) {
  const max = Math.max(1, ...counts.active.map((c) => c.applications), ...counts.closed.map((c) => c.applications));
  const group = (label: string, rows: StatusCount[]) => (
    <>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="rowgroup" colSpan={2} className="h-9 pt-3 text-xs font-medium text-muted-foreground">
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
                  className="block h-2 rounded-sm"
                  style={{ width: `${(applications / max) * 100}%`, backgroundColor: STATS_MARK_COLOR }}
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
  const reachedLabel = STATUS_META[RESPONSE_RATE_FROM.reached].label;
  const respondedLabel = STATUS_META[RESPONSE_RATE_FROM.responded].label;
  if (rate.percent === null) {
    return <p className="text-sm text-muted-foreground">No applications have reached {reachedLabel} yet.</p>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      <p className="text-figure tabular-nums">{rate.percent}%</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        {rate.responded} of {rate.reached} applications that reached {reachedLabel} got to {respondedLabel} or later.
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

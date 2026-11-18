import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { listPipeline } from "@/lib/application-queries";
import {
  NEW_APPLICATION_PATH,
  parsePipelineView,
  PIPELINE_VIEWS,
  type PipelineView,
  pipelineViewPath,
  VIEW_PARAM,
} from "@/lib/applications";
import type { DateOnly } from "@/lib/dates";
import type { PipelineItem } from "@/lib/pipeline";
import { getTimeZone, getToday } from "@/lib/profile";
import { cn } from "@/lib/utils";

import { PipelineBoard } from "./pipeline-board";
import { PipelineTable } from "./pipeline-table";

export const metadata: Metadata = { title: "Applications · JobTracker" };

const VIEW_LABELS = { board: "Board", table: "Table" } as const satisfies Record<PipelineView, string>;

export default function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title">Applications</h1>
        <Button asChild>
          <Link href={NEW_APPLICATION_PATH}>New application</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Pipeline searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Pipeline({ searchParams }: Pick<PageProps<"/applications">, "searchParams">) {
  const [params, items, today, timeZone] = await Promise.all([
    searchParams,
    listPipeline(),
    getToday(),
    getTimeZone(),
  ]);
  const view = parsePipelineView(params[VIEW_PARAM]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <nav aria-label="Pipeline view" className="flex justify-self-start rounded-lg border bg-muted p-0.5">
        {PIPELINE_VIEWS.map((v) => (
          <Link
            key={v}
            href={pipelineViewPath(v)}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              v === view && "bg-card text-foreground shadow-sm",
            )}
          >
            {VIEW_LABELS[v]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-8 text-center text-muted-foreground">
          No applications yet. Add one to get started.
        </p>
      ) : (
        <PipelineContent view={view} items={items} today={today} timeZone={timeZone} />
      )}
    </div>
  );
}

type PipelineContentProps = { view: PipelineView; items: PipelineItem[]; today: DateOnly; timeZone: string };

function PipelineContent({ view, items, today, timeZone }: PipelineContentProps) {
  switch (view) {
    case "board":
      return <PipelineBoard items={items} today={today} />;
    case "table":
      return <PipelineTable items={items} timeZone={timeZone} />;
    default: {
      const unknownView: never = view;
      throw new Error(`Unknown pipeline view: ${String(unknownView)}`);
    }
  }
}

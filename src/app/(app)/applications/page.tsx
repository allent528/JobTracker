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
import { cn } from "@/lib/utils";

import { PipelineBoard } from "./pipeline-board";
import { PipelineTable } from "./pipeline-table";

export const metadata: Metadata = { title: "Applications · JobTracker" };

const VIEW_LABELS = { board: "Board", table: "Table" } as const satisfies Record<PipelineView, string>;

export default function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
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
  const view = parsePipelineView((await searchParams)[VIEW_PARAM]);
  const { items, today, timeZone } = await listPipeline();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <nav aria-label="Pipeline view" className="flex gap-1 justify-self-start rounded-lg bg-muted p-1">
        {PIPELINE_VIEWS.map((v) => (
          <Link
            key={v}
            href={pipelineViewPath(v)}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              v === view && "bg-background text-foreground shadow-sm",
            )}
          >
            {VIEW_LABELS[v]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          No applications yet. Add one to get started.
        </p>
      ) : view === "board" ? (
        <PipelineBoard items={items} today={today} />
      ) : (
        <PipelineTable items={items} timeZone={timeZone} />
      )}
    </div>
  );
}

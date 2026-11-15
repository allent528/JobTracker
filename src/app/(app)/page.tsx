import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listApplications } from "@/lib/application-queries";
import { applicationPath, NEW_APPLICATION_PATH } from "@/lib/applications";

export const metadata: Metadata = { title: "Applications · JobTracker" };

const ARCHIVED_PARAM = "archived";

// Minimal list so applications are reachable; the table and board views (step 5) replace it.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
        <Button asChild>
          <Link href={NEW_APPLICATION_PATH}>New application</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading applications…</p>}>
        <ApplicationList searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function ApplicationList({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const includeArchived = (await searchParams)[ARCHIVED_PARAM] === "1";
  const applications = await listApplications({ includeArchived });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground" role="status">
          {applications.length === 1 ? "1 application" : `${applications.length} applications`}
          {includeArchived ? ", including archived" : ""}
        </p>
        <Link
          href={includeArchived ? "/" : `/?${ARCHIVED_PARAM}=1`}
          className="font-medium underline underline-offset-4"
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>
      {applications.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          {includeArchived ? "No applications yet." : "No active applications. Add one to get started."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {applications.map((app) => (
            <li key={app.id}>
              <Link
                href={applicationPath(app.id)}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block font-medium break-words">{app.company}</span>
                  <span className="block text-sm break-words text-muted-foreground">{app.role_title}</span>
                </span>
                <span className="flex items-center gap-2">
                  {app.archived_at && <Badge variant="outline">Archived</Badge>}
                  <StatusBadge status={app.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { getApplicationOrNotFound } from "@/lib/application-queries";
import { applicationPath, toFormValues } from "@/lib/applications";

import { updateApplication } from "../../actions";
import { ApplicationForm } from "../../application-form";

export const metadata: Metadata = { title: "Edit application · JobTracker" };

export default function EditApplicationPage({ params }: PageProps<"/applications/[id]/edit">) {
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-title">Edit application</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <EditForm params={params} />
      </Suspense>
    </section>
  );
}

async function EditForm({ params }: Pick<PageProps<"/applications/[id]/edit">, "params">) {
  const { id } = await params;
  const application = await getApplicationOrNotFound(id);
  return (
    // Next keeps this route mounted while hidden (docs/learnings.md); a new updated_at remounts
    // the form so it never shows values from before a change made elsewhere.
    <ApplicationForm
      key={application.updated_at}
      action={updateApplication.bind(null, application.id)}
      submitLabel="Save changes"
      defaultValues={toFormValues(application)}
      cancelHref={applicationPath(application.id)}
    />
  );
}

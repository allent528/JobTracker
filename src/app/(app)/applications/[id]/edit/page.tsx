import type { Metadata } from "next";
import { Suspense } from "react";

import { getApplicationOrNotFound } from "@/lib/application-queries";
import { applicationPath, toFormValues } from "@/lib/applications";

import { ApplicationForm } from "../../application-form";

export const metadata: Metadata = { title: "Edit application · JobTracker" };

export default function EditApplicationPage({ params }: PageProps<"/applications/[id]/edit">) {
  return (
    <section className="grid max-w-3xl gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Edit application</h1>
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
    <ApplicationForm
      applicationId={application.id}
      defaultValues={toFormValues(application)}
      cancelHref={applicationPath(application.id)}
    />
  );
}

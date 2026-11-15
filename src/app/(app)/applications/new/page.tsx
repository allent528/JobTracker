import type { Metadata } from "next";

import { APPLICATIONS_PATH, EMPTY_APPLICATION_FORM } from "@/lib/applications";

import { createApplication } from "../actions";
import { ApplicationForm } from "../application-form";

export const metadata: Metadata = { title: "New application · JobTracker" };

export default function NewApplicationPage() {
  return (
    <section className="grid max-w-3xl gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">New application</h1>
      <ApplicationForm
        action={createApplication}
        submitLabel="Create application"
        defaultValues={EMPTY_APPLICATION_FORM}
        cancelHref={APPLICATIONS_PATH}
      />
    </section>
  );
}

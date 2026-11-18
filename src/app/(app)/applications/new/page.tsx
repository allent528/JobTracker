import type { Metadata } from "next";

import { APPLICATIONS_PATH, EMPTY_APPLICATION_FORM } from "@/lib/applications";

import { createApplication } from "../actions";
import { ApplicationForm } from "../application-form";

export const metadata: Metadata = { title: "New application · JobTracker" };

export default function NewApplicationPage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-title">New application</h1>
      <ApplicationForm
        action={createApplication}
        submitLabel="Create application"
        defaultValues={EMPTY_APPLICATION_FORM}
        cancelHref={APPLICATIONS_PATH}
      />
    </section>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { FALLBACK_TIME_ZONE } from "@/lib/dates";
import { getStoredTimeZone } from "@/lib/profile";
import { timeZoneOptions } from "@/lib/time-zones";

import { TimeZoneForm } from "./time-zone-form";

export const metadata: Metadata = { title: "Settings · JobTracker" };

export default function SettingsPage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <TimeZoneSettings />
      </Suspense>
    </section>
  );
}

async function TimeZoneSettings() {
  const stored = await getStoredTimeZone();
  return (
    <section aria-labelledby="time-zone-heading" className="grid gap-3 rounded-lg border p-4">
      <h2 id="time-zone-heading" className="text-xl font-semibold">
        Time zone
      </h2>
      <p className="text-sm text-muted-foreground">
        {stored
          ? `Reminders, "today" and interview times use ${stored}.`
          : `Not set yet, so ${FALLBACK_TIME_ZONE} is used. It's normally detected from your browser when you sign in.`}
      </p>
      {/* Keyed on the saved zone so a hidden, still-mounted copy never shows a stale choice. */}
      <TimeZoneForm key={stored ?? ""} current={stored ?? FALLBACK_TIME_ZONE} options={timeZoneOptions(stored)} />
    </section>
  );
}

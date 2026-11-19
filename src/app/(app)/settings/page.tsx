import type { Metadata } from "next";
import { Suspense } from "react";

import { PanelSection } from "@/components/section-ui";
import { getStoredTimeZone } from "@/lib/profile";
import { effectiveTimeZone, isSupportedTimeZone, timeZoneOptions } from "@/lib/time-zones";

import { TimeZoneForm } from "./time-zone-form";

export const metadata: Metadata = { title: "Settings · JobTracker" };

export default function SettingsPage() {
  return (
    <section className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-title">Settings</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <TimeZoneSettings />
      </Suspense>
    </section>
  );
}

function timeZoneSummary(stored: string | null, used: string): string {
  if (stored === null) return `Not set yet, so ${used} is used. It's normally detected from your browser when you sign in.`;
  if (!isSupportedTimeZone(stored)) return `${stored} can't be used here, so ${used} is used. Pick another time zone.`;
  return `Reminders, "today" and interview times use ${used}.`;
}

async function TimeZoneSettings() {
  const stored = await getStoredTimeZone();
  const used = effectiveTimeZone(stored);
  return (
    <PanelSection id="time-zone" title="Time zone">
      <p className="text-sm text-muted-foreground">{timeZoneSummary(stored, used)}</p>
      {/* Keyed on the saved zone so a hidden, still-mounted copy never shows a stale choice. */}
      <TimeZoneForm key={stored ?? ""} current={used} options={timeZoneOptions(used)} />
    </PanelSection>
  );
}

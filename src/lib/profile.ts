import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { type DateOnly, dateInTimeZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { effectiveTimeZone } from "@/lib/time-zones";

/** Null until it's detected from the browser or picked in settings (F8). */
export const getStoredTimeZone = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Couldn't load your settings.");
  return data?.time_zone ?? null;
});

export const getTimeZone = cache(async (): Promise<string> => effectiveTimeZone(await getStoredTimeZone()));

/** Today in the owner's time zone (D11), once per request so every caller agrees. */
export const getToday = cache(async (): Promise<DateOnly> => {
  // Read the clock only after getTimeZone's request-bound client has called connection(); an earlier
  // `new Date()` fails Cache Components prerendering.
  const timeZone = await getTimeZone();
  return dateInTimeZone(new Date(), timeZone);
});

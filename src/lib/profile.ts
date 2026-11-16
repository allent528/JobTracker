import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { type DateOnly, dateInTimeZone, FALLBACK_TIME_ZONE } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const getTimeZone = cache(async (): Promise<string> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle();
  return data?.time_zone ?? FALLBACK_TIME_ZONE;
});

/** Today in the owner's time zone (D11), once per request so every caller agrees. */
export const getToday = cache(async (): Promise<DateOnly> => {
  // Read the clock only after getTimeZone's request-bound client has called connection(); an earlier
  // `new Date()` fails Cache Components prerendering.
  const timeZone = await getTimeZone();
  return dateInTimeZone(new Date(), timeZone);
});

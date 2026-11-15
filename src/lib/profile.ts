import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { FALLBACK_TIME_ZONE } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** The owner's `profiles.time_zone` (D11), or UTC until it's detected. Deduplicated per request. */
export const getTimeZone = cache(async (): Promise<string> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle();
  return data?.time_zone ?? FALLBACK_TIME_ZONE;
});

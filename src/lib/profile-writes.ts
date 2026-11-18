import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import type { ActionResult } from "@/lib/action-result";
import { writeErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export const PROFILE_NOT_FOUND = "We couldn't find your settings. Sign out and in again.";
export const TIME_ZONE_NOT_RECOGNIZED = "That time zone isn't recognized. Pick another one.";

type TimeZoneWrite = { userId: string; timeZone: string };

function timeZoneError(error: PostgrestError): string {
  // 22023 comes from the profiles trigger that checks the name against pg_timezone_names.
  return error.code === "22023" ? TIME_ZONE_NOT_RECOGNIZED : writeErrorMessage(error);
}

async function timeZoneUpdate({ userId, timeZone }: TimeZoneWrite) {
  const supabase = await createClient();
  // Wrapped: awaiting the builder itself would run the query.
  return { query: supabase.from("profiles").update({ time_zone: timeZone }).eq("id", userId) };
}

export async function saveTimeZone(write: TimeZoneWrite): Promise<ActionResult> {
  const { query } = await timeZoneUpdate(write);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { ok: false, error: timeZoneError(error) };
  if (data === null) return { ok: false, error: PROFILE_NOT_FOUND };
  return { ok: true, data: undefined };
}

/** Leaves a saved zone alone; `changed` says whether this call set it. */
export async function saveTimeZoneIfUnset(write: TimeZoneWrite): Promise<ActionResult<{ changed: boolean }>> {
  const { query } = await timeZoneUpdate(write);
  const { data, error } = await query.is("time_zone", null).select("id").maybeSingle();
  if (error) return { ok: false, error: timeZoneError(error) };
  return { ok: true, data: { changed: data !== null } };
}

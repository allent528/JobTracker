"use server";

import { type ActionResult, parseOr } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { getStoredTimeZone } from "@/lib/profile";
import { saveTimeZone } from "@/lib/profile-writes";
import { revalidateAllPages } from "@/lib/revalidate";
import { type TimeZoneFormValues, timeZoneSchema } from "@/lib/schemas/settings";

export async function updateTimeZone(input: TimeZoneFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = parseOr(timeZoneSchema, input);
  if (!parsed.ok) return parsed;

  const timeZone = parsed.data.time_zone;
  if ((await getStoredTimeZone()) === timeZone) return { ok: true, data: undefined };

  const result = await saveTimeZone({ userId: user.id, timeZone });
  if (!result.ok) return result;

  revalidateAllPages();
  return { ok: true, data: undefined };
}

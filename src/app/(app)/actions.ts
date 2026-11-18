"use server";

import { redirect } from "next/navigation";

import { type ActionResult, parseOr } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth-routes";
import { updateOwnApplication } from "@/lib/owned-rows";
import { saveTimeZoneIfUnset } from "@/lib/profile-writes";
import { revalidateAllPages, revalidateApplication } from "@/lib/revalidate";
import { applicationIdSchema } from "@/lib/schemas/application";
import { type FollowUpDoneValues, followUpDoneSchema } from "@/lib/schemas/follow-up";
import { type TimeZoneFormValues, timeZoneSchema } from "@/lib/schemas/settings";
import { createClient } from "@/lib/supabase/server";

/** Ends the session on this device only (F1) and returns to /login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}

export async function completeFollowUp(id: string, input: FollowUpDoneValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsedId = parseOr(applicationIdSchema, id);
  if (!parsedId.ok) return parsedId;
  const parsed = parseOr(followUpDoneSchema, input);
  if (!parsed.ok) return parsed;

  const result = await updateOwnApplication(user.id, parsedId.data, parsed.data);
  if (!result.ok) return result;

  revalidateApplication(result.data);
  return { ok: true, data: undefined };
}

export async function detectTimeZone(input: TimeZoneFormValues): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = parseOr(timeZoneSchema, input);
  if (!parsed.ok) return parsed;

  const result = await saveTimeZoneIfUnset({ userId: user.id, timeZone: parsed.data.time_zone });
  if (!result.ok) return result;

  if (result.data.changed) revalidateAllPages();
  return { ok: true, data: undefined };
}

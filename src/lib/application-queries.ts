import "server-only";

import { notFound } from "next/navigation";

import type { Application } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { applicationIdSchema } from "@/lib/schemas/application";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type StatusEvent = Pick<Tables<"status_events">, "id" | "from_status" | "to_status" | "changed_at">;
export type ApplicationListItem = Pick<
  Application,
  "id" | "company" | "role_title" | "status" | "archived_at" | "updated_at"
>;

/** The signed-in user's application, or the not-found page (bad id, missing, or someone else's). */
export async function getApplicationOrNotFound(id: string): Promise<Application> {
  const user = await getCurrentUser();
  const parsed = applicationIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Couldn't load the application.");
  if (!data) notFound();
  return data;
}

/** F4 history, newest first. */
export async function getStatusHistory(applicationId: string): Promise<StatusEvent[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("status_events")
    .select("id, from_status, to_status, changed_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("changed_at", { ascending: false });
  if (error) throw new Error("Couldn't load the status history.");
  return data;
}

/** Minimal list for the home page until the step 5 views; archived rows only when asked (D10). */
export async function listApplications({ includeArchived }: { includeArchived: boolean }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  let query = supabase
    .from("applications")
    .select("id, company, role_title, status, archived_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("Couldn't load your applications.");
  return data satisfies ApplicationListItem[];
}

"use server";

import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth-routes";
import { createClient } from "@/lib/supabase/server";

/** Ends the session on this device only (F1) and returns to /login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}

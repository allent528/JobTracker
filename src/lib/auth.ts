import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { loginUrl } from "@/lib/auth-routes";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in user, verified with getClaims() (never getSession()).
 * Redirects to /login when signed out. Call it inside a <Suspense> boundary.
 * Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect(loginUrl());
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

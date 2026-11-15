import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { LOGIN_PATH } from "@/lib/auth-routes";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in user, verified with getClaims() (never getSession()).
 * Redirects to /login when signed out. Call it inside a <Suspense> boundary.
 * Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Auth runs only for a real request, never in a prerender or prefetch:
  // getClaims() reads Date.now() to check token expiry, which Cache
  // Components rejects while prerendering.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect(LOGIN_PATH);
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

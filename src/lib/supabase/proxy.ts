import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { HOME_PATH, isPublicPath, LOGIN_PATH, loginUrl } from "@/lib/auth-routes";
import type { Database } from "@/types/database.types";

import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session on every request and redirects signed-out
 * users to /login. Called only from src/proxy.ts. This is a first gate, not
 * authorization: pages and actions re-check the user.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Keep this call right after createServerClient: it verifies the JWT and
  // refreshes the session, writing new cookies through setAll above.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  // A redirect must carry any refreshed session cookies and the no-cache headers.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (/^(cache-control|expires|pragma)$/i.test(key)) redirect.headers.set(key, value);
    });
    return redirect;
  };

  if (!signedIn && !isPublicPath(pathname)) return redirectTo(loginUrl({ next: `${pathname}${search}` }));
  if (signedIn && pathname === LOGIN_PATH) return redirectTo(HOME_PATH);
  return response;
}

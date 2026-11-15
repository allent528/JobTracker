import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { HOME_PATH, LINK_ERROR, loginUrl } from "@/lib/auth-routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link target: `/auth/confirm?token_hash=…&type=email`.
 * Exchanges the token hash for a session (D16) and lands on home.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type === "email") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(HOME_PATH);
  }

  redirect(loginUrl({ error: LINK_ERROR }));
}

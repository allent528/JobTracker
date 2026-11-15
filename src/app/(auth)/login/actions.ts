"use server";

import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { safeNextPath } from "@/lib/auth-routes";
import {
  type SignInEmailInput,
  signInEmailSchema,
  type VerifyCodeInput,
  verifyCodeSchema,
} from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

const INVALID_INPUT = "Check the form and try again.";

/**
 * Sends the sign-in email (magic link + code). Never creates a user.
 * Unknown emails (422) and rate limits (429) get the same "check your email"
 * answer as a sent email, so the response doesn't reveal whether an account
 * exists. Only a server or network failure is reported.
 */
export async function requestSignInEmail(input: SignInEmailInput): Promise<ActionResult> {
  const parsed = signInEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });

  if (error && (!error.status || error.status >= 500)) {
    return { ok: false, error: "We couldn't send the email right now. Try again in a minute." };
  }
  return { ok: true, data: undefined };
}

/**
 * Verifies the code from the email and redirects to `next` (same-origin only).
 * Returns only on failure.
 */
export async function verifySignInCode(
  input: VerifyCodeInput,
  next?: string | null,
): Promise<ActionResult<never>> {
  const parsed = verifyCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) return { ok: false, error: "That code is wrong or has expired. Check the latest email." };

  redirect(safeNextPath(next));
}

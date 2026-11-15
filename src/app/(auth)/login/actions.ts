"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth-routes";
import {
  type SignInEmailInput,
  signInEmailSchema,
  type VerifyCodeInput,
  verifyCodeSchema,
} from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

/**
 * Sends the sign-in email (magic link + 6-digit code). Never creates a user.
 * Unknown emails and rate limits get the same "check your email" answer, so
 * the response doesn't reveal whether an account exists.
 */
export async function requestSignInEmail(input: SignInEmailInput): Promise<AuthActionResult> {
  const parsed = signInEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });

  // Only a server or network failure is reported; it says nothing about the account.
  if (error && (!error.status || error.status >= 500)) {
    return { ok: false, error: "We couldn't send the email right now. Try again in a minute." };
  }
  return { ok: true };
}

/** Verifies the 6-digit code from the email and redirects to `next` (same-origin only). */
export async function verifySignInCode(
  input: VerifyCodeInput,
  next?: string | null,
): Promise<AuthActionResult> {
  const parsed = verifyCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) return { ok: false, error: "That code is wrong or has expired. Check the latest email." };

  redirect(safeNextPath(next));
}

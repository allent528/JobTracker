import { z } from "zod";

/** Matches `otp_length` in supabase/config.toml and the prod Auth settings. */
export const OTP_LENGTH = 6;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { error: `Enter the ${OTP_LENGTH}-digit code from the email.` });

/** Step 1 of sign-in: request the email with the magic link and code. */
export const signInEmailSchema = z.object({ email });

/** Step 2 of sign-in: enter the code from that email. */
export const verifyCodeSchema = z.object({ email, code });

export type SignInEmailInput = z.input<typeof signInEmailSchema>;
export type VerifyCodeInput = z.input<typeof verifyCodeSchema>;

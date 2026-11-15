import { z } from "zod";

/** Matches `otp_length` in supabase/config.toml and the prod Auth settings. */
export const OTP_LENGTH = 6;

const CODE_ERROR = `Enter the ${OTP_LENGTH}-digit code from the email.`;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

const code = z
  .string()
  .trim()
  .length(OTP_LENGTH, { error: CODE_ERROR })
  .regex(/^\d+$/, { error: CODE_ERROR });

export const signInEmailSchema = z.object({ email });

export const verifyCodeSchema = z.object({ email, code });

export type SignInEmailInput = z.input<typeof signInEmailSchema>;
export type VerifyCodeInput = z.input<typeof verifyCodeSchema>;

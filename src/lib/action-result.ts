import type { z } from "zod";

/** What every Server Action returns (see .claude/rules/server-actions.md). */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Shown when a Server Action call itself fails (offline, server down), not when it returns an error. */
export const UNREACHABLE_ERROR = "Couldn't reach the server. Try again.";

const INVALID_INPUT = "Check the form and try again.";

/** Server Actions parse untrusted input with the form's schema; the first issue becomes the error. */
export function parseOr<S extends z.ZodType>(schema: S, input: unknown): ActionResult<z.output<S>> {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };
}

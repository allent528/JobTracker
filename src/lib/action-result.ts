/** What every Server Action returns (see .claude/rules/server-actions.md). */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Shown when a Server Action call itself fails (offline, server down), not when it returns an error. */
export const UNREACHABLE_ERROR = "Couldn't reach the server. Try again.";

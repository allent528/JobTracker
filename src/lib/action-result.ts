/** What every Server Action returns (see .claude/rules/server-actions.md). */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

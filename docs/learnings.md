# Learnings

<!-- Append when you hit a bug, a wrong assumption, or a non-obvious fix.

## YYYY-MM-DD: <short title>
- **Mistake:** what went wrong
- **Root cause:** why
- **Fix:** what changed
- **Lesson:** the rule for next time (and update the matching .claude/rules/ file)
-->

## 2026-11-14: shadcn init adds a `cn` package, not clsx + tailwind-merge
- **Mistake:** Expected `src/lib/utils.ts` to define `cn` with clsx + tailwind-merge; it re-exports from an npm package named `cn`, which looked like a typosquat.
- **Root cause:** Current shadcn CLI uses its own compiled class merger (`cn`, repo `shadcn-ui/cn`, maintainer shadcn).
- **Fix:** Verified the package's repo and maintainer with `npm view`; kept it.
- **Lesson:** Check unfamiliar deps a generator adds (`npm view <pkg> repository.url maintainers`) before accepting them.

## 2026-11-14: getClaims() breaks prerender/prefetch under Cache Components
- **Mistake:** The signed-in layout called `getClaims()` inside `<Suspense>`; dev logged "Route "/": Next.js encountered the unstable value `Date.now()` while prerendering" once a user was signed in.
- **Root cause:** `partialPrefetching` prerenders with real cookies, so the `cookies()` read doesn't suspend; supabase-js then reads `Date.now()` synchronously to check token expiry.
- **Fix:** `getCurrentUser()` (`src/lib/auth.ts`) calls `await connection()` before creating the client, so auth only runs for a real request.
- **Lesson:** Every session read goes through `getCurrentUser()`; never call `getClaims()`/`getUser()` directly in a component. Added to `.claude/rules/auth.md`.

## 2026-11-14: Next dev logs Server Action arguments
- **Mistake:** The dev terminal showed `requestSignInEmail({"email":…})` and `verifySignInCode({"code":"…"})`.
- **Root cause:** Next 16 logs Server Function calls with arguments in dev by default (`logging.serverFunctions`).
- **Fix:** `logging: { serverFunctions: false }` in `next.config.ts`.
- **Lesson:** Personal data stays out of logs, including dev logs; keep this off (later actions carry contacts and salaries).

## 2026-11-14: Bash heredocs on this machine collapse `\`
- **Mistake:** Test and regex source written with `cat <<'EOF'` lost backslashes (a JS literal meant to hold two backslashes kept one, so `"/\\evil"` turned into `"/\evil"`, which is just `"/evil"`; a regex `\d` lost its backslash), and a Python one-liner wrote raw control bytes into a .ts file.
- **Root cause:** The Git Bash tool layer on Windows unescapes `\` before the heredoc runs.
- **Fix:** Rewrote those files with the Write/Edit tools.
- **Lesson:** Write source files containing backslashes with Write/Edit, not shell heredocs or inline Python.

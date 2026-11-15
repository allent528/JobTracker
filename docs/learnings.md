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
- **Mistake:** The signed-in layout called `getClaims()` inside `<Suspense>`. Once a user was signed in, dev logged "Route "/": Next.js encountered the unstable value `Date.now()` while prerendering".
- **Root cause:** `partialPrefetching` prerenders with real cookies, so the `cookies()` read doesn't suspend. supabase-js then reads `Date.now()` synchronously to check token expiry.
- **Fix:** `createClient()` in `src/lib/supabase/server.ts` calls `await connection()` before anything else, so every server client (and so every read in later steps) runs only for a real request. `connection()` resolves normally in Server Actions and Route Handlers.
- **Lesson:** Server reads go through the guarded `createClient()`; never build a server client another way. Recorded in `.claude/rules/auth.md`.

## 2026-11-14: Next dev logs Server Action arguments
- **Mistake:** The dev terminal showed `requestSignInEmail({"email":…})` and `verifySignInCode({"code":"…"})`.
- **Root cause:** Next 16 logs Server Function calls with arguments in dev by default (`logging.serverFunctions`).
- **Fix:** `logging: { serverFunctions: false }` in `next.config.ts`.
- **Lesson:** Personal data stays out of logs, including dev logs; keep this off (later actions carry contacts and salaries).

## 2026-11-14: Bash heredocs on this machine lose backslashes
- **Mistake:** Source files written with `cat <<'EOF'` in the Bash tool came out with fewer backslashes than intended. A test input written as the JS source `"/\\evil.example.com"` (two backslashes) was saved as `"/\evil.example.com"`, which JS reads as `"/evil.example.com"`. A regex built from the string `"^\\d{6}$"` was saved as `"^\d{6}$"`, which JS reads as `"^d{6}$"` (six letter d's). A Python one-liner used to patch a file wrote raw control bytes into it.
- **Root cause:** Not fully pinned down. The tool layer between the model and Git Bash on Windows appears to unescape `\` before the heredoc runs.
- **Fix:** Rewrote those files with the Write and Edit tools and checked the bytes with `grep`.
- **Lesson:** Write or edit any file that contains backslashes with Write/Edit, not shell heredocs or inline scripts.

## 2026-11-14: Open redirect through dot segments in `?next=`
- **Mistake:** The first `safeNextPath` rejected inputs starting with `//` and then returned the parsed path. The security review showed `/.//evil.example.com`, `/a/..//evil.example.com` and `/%2e%2e//evil.example.com` all came back as `//evil.example.com`, a protocol-relative redirect off-site.
- **Root cause:** The `//` check ran on the raw input, but URL parsing removes dot segments afterwards, which can produce a leading `//`.
- **Fix:** Check the normalized result: return `/` unless the origin is ours, the normalized path doesn't start with `//`, and it isn't a public path. Unit tests cover these inputs plus a "never starts with //" sweep; the e2e uses `?next=/.//evil.example.com`.
- **Lesson:** Validate the normalized URL, not the input string.

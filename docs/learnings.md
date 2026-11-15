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

## 2026-11-14: `default (select auth.uid())` is invalid Postgres
- **Mistake:** `.claude/rules/database.md` told every table to use `user_id ... default (select auth.uid())`.
- **Root cause:** Postgres rejects subqueries in column defaults ("cannot use subquery in DEFAULT expression"). The `(select ...)` wrapper is an RLS-policy performance trick, not a default.
- **Fix:** Columns use `default auth.uid()`; policies keep `(select auth.uid())`. Rule corrected.
- **Lesson:** Verify snippets copied into rule files against a real database.

## 2026-11-14: `supabase db query` runs one statement per call
- **Mistake:** A multi-statement string (and `-f` with several statements) failed with "cannot insert multiple commands into a prepared statement".
- **Root cause:** The CLI sends the SQL as a single prepared statement.
- **Fix:** Run statements one per call.
- **Lesson:** Recorded in `.claude/rules/database.md`.

## 2026-11-14: Unique constraints are checked before foreign keys
- **Mistake:** An RLS test expected 23503 (FK) when B inserted an interview_contacts row reusing A's existing interview/contact pair, but got 23505 (unique).
- **Root cause:** Unique indexes are checked while the row is inserted; FK checks run afterwards (as constraint triggers).
- **Fix:** That ordering was a small existence oracle (someone knowing both UUIDs could tell whether another user had linked them). The security re-review closed it: the key is now `unique (user_id, interview_id, contact_id)`, so a forged pair never collides and always fails the FK with 23503. Tests cover insert and `upsert(..., { ignoreDuplicates: true })` of an existing pair.
- **Lesson:** Lead unique keys on user-owned rows with `user_id`. Recorded in `.claude/rules/database.md` and `testing.md`.

## 2026-11-14: Next 16 keeps the previous route mounted, hidden
- **Mistake:** The applications e2e failed with a strict-mode violation: `getByLabel("Company")` matched two inputs after navigating from `/applications/new` to the edit page.
- **Root cause:** With Cache Components, the router keeps recently visited pages mounted inside a hidden React `<Activity>` (`display: none`), so their form fields stay in the DOM. `getByRole` skips hidden elements; `getByLabel` and CSS locators don't.
- **Fix:** The spec's `field()` helper uses `getByLabel(label).filter({ visible: true })`; the status select is found by role. A check that the next "New application" form starts blank guards against stale state leaking from the hidden copy.
- **Lesson:** In e2e, prefer role locators or add `.filter({ visible: true })`. Recorded in `.claude/rules/testing.md`.

## 2026-11-14: zodResolver with a transforming schema vs the shadcn FormField types
- **Mistake:** `useForm<Input, unknown, Output>` with `zodResolver(applicationSchema)` failed to typecheck against the generated `FormField` (its `ControllerProps` has no transformed-values parameter).
- **Root cause:** The application schema turns strings into numbers and nulls, so input and output types differ, and `src/components/ui/form.tsx` (generated, not to be forked) assumes they're equal.
- **Fix:** `zodResolver(schema, undefined, { raw: true })` validates with the schema but hands back the raw string values. The Server Action parses those raw values with the same schema, so the stored values are identical.
- **Lesson:** Forms whose schema transforms values use raw mode and send the raw input to the action. Recorded in `.claude/rules/ui.md`.

## 2026-11-14: Hidden, still-mounted routes also keep stale form state
- **Mistake:** The edit form seeds react-hook-form from `defaultValues` once. After Edit, Cancel and a status change (whose trigger sets date applied), opening Edit again showed the old blank date, and saving would have cleared it.
- **Root cause:** The hidden edit route stayed mounted (see the Activity entry above), so the form never remounted with fresh server values.
- **Fix:** `<ApplicationForm key={application.updated_at} …/>` remounts it whenever the row changes. The e2e covers Edit, Cancel, Move to Applied, Edit (it fails without the key).
- **Lesson:** Client state seeded from server data needs a `key` that changes with that data. Recorded in `.claude/rules/ui.md`.

## 2026-11-14: Edit and heredocs decode `\u` escapes in new text
- **Mistake:** A test written with Edit as `"From ZZZ\u00a0150,000"` was saved with a literal no-break space, an invisible character in the source.
- **Root cause:** The tool layer turned the escape into the character. Writing this entry with a Bash heredoc did the same.
- **Fix:** Rewrote the escape with a Node one-liner that builds the backslash with `String.fromCharCode(92)`, then checked the bytes with `od -c`.
- **Lesson:** After writing an escape sequence, grep the file to check it's still an escape.

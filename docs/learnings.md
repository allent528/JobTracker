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

## 2026-11-14: Multi-line `node -e` replacements silently did nothing
- **Mistake:** Several `node -e` scripts using `s.replace(<multi-line template literal>, …)` reported success but left files unchanged; one with `"\n"` in the replacement didn't apply either.
- **Root cause:** Probably the same tool-layer escaping as the 2026-11-14 heredoc entries above: the script Node ran wasn't byte-for-byte what was written, so the search string never matched. `String.prototype.replace` doesn't fail on no match.
- **Fix:** Redid those edits with the Edit tool and checked them with `git diff`.
- **Lesson:** Use the Edit tool for multi-line or escape-bearing changes; after any scripted edit, check `git diff` before moving on.

## 2026-11-14: A page that only calls redirect() fails Cache Components validation
- **Mistake:** `src/app/(app)/page.tsx` was just `redirect("/applications")`. Dev logged "Route "/": Could not validate `instant` because an error prevented the target segment from rendering". Moving it to `redirects()` in `next.config.ts` then broke code sign-in: the Server Action's `redirect("/")` stayed on `/`.
- **Root cause:** Cache Components prerenders the page to validate it, and the redirect throws during that prerender. `next.config` redirects only apply to incoming HTTP requests; a Server Action redirect renders the target route in the same request, so it never sees them.
- **Fix:** The page renders `<Suspense>` around an async component that awaits `connection()` and then calls `redirect()`, so it runs only at request time and works for both browser loads and Server Action redirects.
- **Lesson:** Request-time redirects in pages go behind `connection()` inside Suspense. Don't use `next.config` redirects for paths that Server Actions redirect to.

## 2026-11-14: sr-only text inside a horizontal scroller widened the page
- **Mistake:** At 375px the board looked right but the page scrolled 957px sideways.
- **Root cause:** Tailwind's `sr-only` is `position: absolute`. An absolutely positioned box is clipped by an overflow ancestor only if that ancestor (or something inside it) is its containing block. The board scroller wasn't positioned, so each column's sr-only count was positioned against the initial containing block, outside the scroller's clipping, and the page's scroll width grew to reach the last one.
- **Fix:** The scroller is `relative`. Found by listing elements whose `getBoundingClientRect().right` passed the viewport (none was wider than it).
- **Lesson:** Give any overflow container that holds absolutely positioned content (sr-only text, badges) `position: relative`. Recorded in `.claude/rules/ui.md`.

## 2026-11-14: Bulk inserts through PostgREST null out missing columns
- **Mistake:** An e2e seed inserted rows where only some set `updated_at`; the others failed with 23502 (null in a not-null column).
- **Root cause:** For a multi-row insert, PostgREST uses the union of keys as the column list and sends null where a row leaves a key out, skipping column defaults.
- **Fix:** `insert(rows, { defaultToNull: false })` in `seedApplications`, so missing keys get the column default.
- **Lesson:** Pass `defaultToNull: false` to bulk inserts whose rows don't all have the same keys. Recorded in `.claude/rules/testing.md`.

## 2026-11-14: Radix menus can drop the first arrow key after a keyboard open
- **Mistake:** The e2e opened a card's Move menu with Enter and pressed ArrowDown twice expecting Screening; focus landed on Applied.
- **Root cause:** Likely cause: right after a keyboard open, Radix moves focus to the first item asynchronously and an ArrowDown that arrives first is ignored. Not confirmed; it was timing-dependent.
- **Fix:** The test presses ArrowDown inside `expect(...).toPass()` until the target item has focus.
- **Lesson:** Drive Radix menus in e2e by "press until focused", not a fixed key count. Recorded in `.claude/rules/testing.md`.

## 2026-11-15: `dateInTimeZone(new Date(), await getTimeZone())` read the clock too early
- **Mistake:** The new `getToday()` made the browser console report "Route "/applications": Next.js encountered the unstable value `new Date()` while prerendering". The e2e suite still passed, and the dev server log was clean, so only a console listener caught it.
- **Root cause:** JavaScript evaluates call arguments left to right, so `new Date()` ran before `await getTimeZone()` reached `connection()`. Reading the clock before request-bound data fails Cache Components prerendering.
- **Fix:** `getToday()` awaits the time zone first, then calls `new Date()`.
- **Lesson:** In server code, read the clock only after an awaited request-bound read, never in an argument list beside an `await`. After a UI change, check the browser console as well as the server log.

## 2026-11-15: A rejected Server Action inside startTransition crashes to the error screen
- **Mistake:** The board's move handled `{ ok: false }` results, but an aborted request (offline, server down) rejected the action's promise inside `startTransition`, which sent the page to the error boundary.
- **Root cause:** Errors thrown inside a transition go to the nearest error boundary. Returning `ActionResult` covers only failures the server reports.
- **Fix:** `useChangeStatus` wraps the call in try/catch and toasts `UNREACHABLE_ERROR`; the optimistic move rolls back when the transition ends. `src/app/(app)/error.tsx` is a safety net for anything else. An e2e aborts the action request with `page.route` and fails without the try/catch.
- **Lesson:** Client calls to Server Actions inside a transition catch rejections. Recorded in `.claude/rules/ui.md`.

## 2026-11-15: supabase-js can't type `.from()` over a union of table names
- **Mistake:** A generic `updateOwnChild<T extends "notes" | "contacts" | "interviews">(table: T, patch: TablesUpdate<T>)` failed to typecheck: `.update(patch)` and even `.eq("id", …)` were rejected.
- **Root cause:** supabase-js resolves the builder's row types from a single literal table name; a generic or union parameter leaves them unresolved.
- **Fix:** `owned-rows.ts` checks the caller's row against `TablesInsert<T>` / `TablesUpdate<T>` in the signature, then types the builder as one table (`table as "notes"`). A compile-time check confirms every child table has the `id`, `user_id` and `application_id` columns the helpers use.
- **Lesson:** Check types in the generic signature and at the call site, then cast once inside the helper. Recorded in `.claude/rules/server-actions.md`.

## 2026-11-15: `getByLabel` also matches `aria-label`
- **Mistake:** The e2e's `getByLabel("Edit note")` matched the edit textarea and the note's Edit button (whose `aria-label` was "Edit note"). Several notes would also have had identical "Edit note" buttons for screen-reader users.
- **Root cause:** Playwright's `getByLabel` matches `aria-label` as well as `<label>` text.
- **Fix:** Row buttons now carry distinct names ("Edit note added Nov 15, 2026, 9:05 PM", "Delete contact Jane Doe"); the spec finds the field with `getByRole("textbox", { name: "Edit note" })`.
- **Lesson:** Repeated row actions need distinct accessible names; in e2e prefer role locators when a label's text also appears in a button name. Recorded in ui.md and testing.md.

## 2026-11-15: An open form can hold ids of rows deleted since it opened
- **Mistake:** With the interview form open, deleting a picked contact in the Contacts section left its id in the form's `contact_ids`. Adding then failed until the form was cancelled; editing saved the other fields and reported a failure.
- **Root cause:** The form state was seeded when it opened. The re-render after the delete removed the checkbox but not the value, and the composite FK rejected the link (23503).
- **Fix:** The interview form keeps only ids of current contacts when it submits. The e2e deletes a picked contact with the Add and the Edit form open; it fails without the filter.
- **Lesson:** Client form state that refers to other rows must be checked against the current rows on submit.

## 2026-11-15: `Date.UTC` maps years 0–99 to the 1900s
- **Mistake:** The interview schema accepted any four-digit year, so "0026-12-01T10:00" would have been stored as 1926.
- **Root cause:** `Date.UTC(26, …)` means 1926, and `datetime-local` can't show years below 1000 either.
- **Fix:** The schema accepts years 1900–2999, with unit tests at both ends.
- **Lesson:** Bound years in any date input that goes through `Date.UTC`.

## 2026-11-15: A heading plus an inline count span ran together in the accessible name
- **Mistake:** The e2e looked for a region named "Today (2)" and found none, though the page showed that text.
- **Root cause:** The heading was `Today` followed by `<span class="ml-2">(2)</span>` on the next line. JSX drops that line break, and margin isn't text, so the accessible name was "Today(2)". Screen readers read it the same way.
- **Fix:** `{label}{" "}<span>…</span>`.
- **Lesson:** Visual spacing (margin, gap) doesn't add a space to accessible names; put a real space between text nodes. Recorded in ui.md.

## 2026-11-15: Intl's time zone list leaves out UTC and uses old canonical names
- **Mistake:** Planned to validate time zones with `Intl.supportedValuesOf("timeZone").includes(value)`.
- **Root cause:** Node's list has no `UTC` (our fallback) and returns `Asia/Calcutta`, not `Asia/Kolkata`, while browsers may report either. Newer Intl versions also accept offset zones like `+05:00`, which Postgres's `pg_timezone_names` doesn't list.
- **Fix:** `isSupportedTimeZone` checks an IANA-shaped name and that `Intl.DateTimeFormat` accepts it; the settings list adds UTC and the saved zone to Intl's list. The DB trigger stays the final check.
- **Lesson:** Validate zones by "Intl can format in it" plus a name shape, not by membership in `supportedValuesOf`.

## 2026-11-17: A full page load can show a hidden duplicate of streamed content
- **Mistake:** The stats isolation e2e failed about one run in six with a strict-mode violation. Right after `page.goto`, `getByText("No applications to count yet.")` matched two paragraphs, one of them hidden.
- **Root cause:** Hidden copies don't only come from the routes Activity keeps mounted (2026-11-14 entry). While a Suspense boundary streams in, the DOM can briefly hold a hidden copy of the content, and `getByText` doesn't skip hidden elements.
- **Fix:** `getByText(message, { exact: true }).filter({ visible: true })`. Found with `--repeat-each=6 --workers=1`.
- **Lesson:** Text and label locators on streamed content need `.filter({ visible: true })`; role locators already skip hidden elements. Repeat a new spec serially before calling it stable.

## 2026-11-17: Time zone detection re-rendered the board in the middle of a test
- **Mistake:** The pipeline rollback e2e (step 5) failed every time when run alone, on `main` too, but passed inside the full suite. The open Move menu was detached and its card ("Gone Co", already deleted in the database) vanished from the board.
- **Root cause:** `signInAs` clears `profiles.time_zone`, so the first signed-in page runs `detectTimeZone`, which revalidates every page. On a cold dev server that action finished after the test had moved on, and the refresh re-rendered the board from the database.
- **Fix:** `signInAs` now waits until the zone is saved and the network is idle before returning.
- **Lesson:** A fixture that triggers background work (detection, revalidation) waits for it to finish. Run a failing e2e on its own and on `main` before calling it a flake.

## 2026-11-18: Dark mode never applied
- **Mistake:** The shadcn setup shipped dark tokens under `.dark` and a `dark:` variant on `.dark *`, and earlier dark screenshots added the class by hand. Nothing in the app ever set it, so users always got the light theme.
- **Root cause:** shadcn's default assumes a theme provider (next-themes) toggles the class, and this app has none.
- **Fix:** `@custom-variant dark (@media (prefers-color-scheme: dark))`, with the dark tokens inside the same media query. Dark screenshots use Playwright's `colorScheme: "dark"`.
- **Lesson:** Check that a theme really switches through a browser setting (OS or emulated), not by injecting the class. Recorded in ui.md.

## 2026-11-18: `cn` dropped a custom font-size role
- **Mistake:** `<FormLabel className="text-heading">` rendered at the label's default 14px.
- **Root cause:** `cn` merges conflicting utilities but doesn't know the custom `text-heading` theme role is a font size, so the component's own `text-sm` won.
- **Fix:** Put the role on an inner `<span>`.
- **Lesson:** Custom type roles go on plain elements or an inner span, not through a component's `className`. Recorded in ui.md.

## 2026-11-18: shadcn's focus ring disappears on the primary button
- **Mistake:** Keyboard focus on "New application" was nearly invisible.
- **Root cause:** shadcn draws focus as a 3px box-shadow ring at 50% of `--ring`. With an ink-black primary button and an ink ring, the ring blends into the button.
- **Fix:** One global unlayered `:focus-visible` rule: a 2px solid `--ring` outline, offset 2px, with `--tw-ring-shadow` cleared. Menu items, dialogs and `tabindex="-1"` targets are excluded.
- **Lesson:** After a palette change, check focus on every button variant, not just on inputs.

## 2026-11-18: Stopping `npm start` left `next start` running
- **Mistake:** After stopping the background `npm start` and rebuilding, the next `npm start` failed with EADDRINUSE, and the old server kept serving the replaced build.
- **Root cause:** On Windows, stopping the npm process doesn't stop its `next start` child.
- **Fix:** Find and stop the process on the port: `Get-NetTCPConnection -LocalPort 3000 -State Listen`, then `Stop-Process` on its owner.
- **Lesson:** After stopping a dev or prod server, confirm the port is free before starting another or running e2e.

## 2026-11-18: A long heredoc failed to parse in the Bash tool
- **Mistake:** Appending two doc entries with `cat >> file <<'EOF'` failed with "unexpected EOF while looking for matching `''", and nothing was written.
- **Root cause:** Not pinned down; likely the same tool-layer rewriting as the 2026-11-14 heredoc entries, here on text with apostrophes and backticks.
- **Fix:** Appended with the Edit tool.
- **Lesson:** Write prose with Write or Edit, not heredocs.

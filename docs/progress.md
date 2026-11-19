# Progress log

<!-- Append one entry per finished task. Newest at the bottom.

## YYYY-MM-DD: <task / PRD step>
**Status:** Done | Partial | Blocked
**What was done**
- ...
**Files:** ...
**Checks:** typecheck / tests / verification / security-reviewer results
**Decisions / defaults** (PRD open questions answered with the proposed default)
**Follow-ups**
-->

## 2026-11-14: PRD update, broaden L4 browser extension
**Status:** Done
**What was done**
- L4 now covers any job page, not just LinkedIn/Indeed. Auto-fill is best effort: site-specific readers for LinkedIn and Indeed, schema.org `JobPosting` data where present, otherwise URL and page title only. L4 reuses L3's page parsing.
**Files:** docs/prd/PRD.md
**Checks:** n/a (docs only)
**Decisions / defaults**
- Owner decision: L4 should work on any job page.
**Follow-ups**
- Still post-v1; v1 non-goals unchanged.

## 2026-11-14: Claude Code setup (10xengineer-setup)
**Status:** Done (pre-code; launch step 1 not started)
**What was done**
- Scaffolded packs core, web, supabase: agents (planner, verification, security-reviewer, git-commit), skills (validate-fix, code-quality-review, webapp-testing, db-migration, web-design-engineer, supabase, supabase-postgres-best-practices), secret-blocking pre-commit hook, CI.
- Drafted the PRD with the owner: F1–F9, lifecycle, data model, launch plan, later steps L1–L4, technical decisions D1–D16.
- Filled `.claude/CLAUDE.md` (stack, layout, commands, environment, non-negotiable rules) and wrote rules: database, auth, server-actions, ui, testing.
- Added minimal `package.json` (prepare, db:types, supabase CLI dev dep), `.gitattributes` (LF for hooks/scripts), CI lint + `next build` jobs, `.env.example` vars.
**Files:** `.claude/**`, `docs/**`, `scripts/precommit.mjs`, `.githooks/pre-commit`, `.github/workflows/ci.yml`, `.mcp.json`, `.env.example`, `.gitattributes`, `.gitignore`, `package.json`, `skills-lock.json`
**Checks:** pre-commit blocks a staged fake `sk_test_` key and exits 0 on a clean index; all JSON configs parse; agent/skill frontmatter valid; no `{{…}}`/`FILL:` left.
**Decisions / defaults**
- D2 changed during setup: local Supabase in Docker for dev + one hosted JobTracker (`skcsrdyqsqkinrrwtdyh`) (a local stack is faster and disposable; corrected 2026-11-14: the owner's account isn't limited to 2 projects). D15 therefore turns Vercel previews off.
- Hosted project is named JobTracker (ref `skcsrdyqsqkinrrwtdyh`), not jobtracker-prod. `.mcp.json` is scoped to it with the features from the Supabase dashboard's install command.
**Follow-ups**
- Done: project created, MCP scoped to it, `/mcp` sign-in complete. Owner: finish installing Docker Desktop; before the first prod migration run `npx supabase login` and `npx supabase link --project-ref skcsrdyqsqkinrrwtdyh`.
- On first commit: `git add .githooks/pre-commit && git update-index --chmod=+x .githooks/pre-commit`.
- `.claude/rules/_TEMPLATE.md` kept as a reference for new rule files.
- Next: plan launch step 1 (project skeleton) with the planner agent. `create-next-app` won't run in a non-empty folder, so scaffold it in a temp dir and merge.

## 2026-11-14: Launch step 1 (project skeleton): planned, not started
**Status:** Partial (plan only). Branch `feat/project-skeleton` exists off `main` (d52d173); only doc fixes on it so far.
**Owner decisions for step 1**
- Next 16 `src/proxy.ts`, not `middleware.ts` (docs and the auth rule already updated).
- `typecheck` = `next typegen && tsc --noEmit` (CI has no `next-env.d.ts`).
- Playwright: Chromium only for now; add Firefox/WebKit before launch.
**Plan (from the planner agent)**
1. Run `npx create-next-app@latest jt-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --skip-install --yes` in a scratch dir (it refuses non-empty dirs). The 2026-11-14 run gave Next 16.4.6, React 19.3, Tailwind 4.3.3 via `@tailwindcss/turbopack` in `next.config.ts` (no postcss config).
2. Copy `src/`, `public/`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` and `AGENTS.md` (`next dev` re-adds it anyway) into the repo root.
   - Hand-merge `package.json`, keeping `prepare`, `db:types` and devDependency `supabase`. Add `dev`, `build`, `start` and `lint` = `eslint .`.
   - Append to `.gitignore`: `next-env.d.ts`, `*.tsbuildinfo`, `playwright-report/`, `blob-report/`, `playwright/.cache/`.
   - Do a fresh `npm install` (delete `package-lock.json` first).
3. Minimal `page.tsx` (h1 "JobTracker"). Drop the `next/font/google` Geist import and the boilerplate SVGs. Set the metadata title.
4. `npx shadcn@latest init` (neutral), then `add button`.
5. Create `src/lib/status.ts`: the 9 PRD statuses with value, label and kind, `as const`, plus `ACTIVE_STATUSES` / `CLOSED_STATUSES`. Add `status.test.ts`, Vitest, `vitest.config.mts` (`include: src/**/*.test.ts`) and `"test": "vitest run"`.
6. Add the `typecheck` script. Verify it from a clean state (no `.next`, no `next-env.d.ts`).
7. Install `@playwright/test` and run `npx playwright install chromium`. Add `playwright.config.ts` (`testDir: tests/e2e`, webServer `npm run dev`) and `tests/e2e/smoke.spec.ts` (`.spec.ts`: `.gitignore` ignores `*.e2e`). Add `"test:e2e"`, and add the Playwright folders to the eslint ignores.
8. `npm i @supabase/supabase-js @supabase/ssr`, with no code using them yet.
9. Run `npx supabase init` and `start` locally. Never `link`. Add a `supabase/seed.sql` comment-only stub and `enable_signup = false` in `config.toml`. Check `status` ports and `db reset`, and that `npm run db:types` gives a UTF-8 file that typechecks.
10. Create `.env.local` from `npx supabase status` (URL, publishable key, local secret key for tests). Change the `.env.example` comment to "Copy to .env.local". Check the hook blocks `.env.local`.
11. CI parity: the lockfile contains `@next/swc-linux-x64-gnu`, `lightningcss-linux-x64-gnu` and `@tailwindcss/oxide-linux-x64-gnu`. Then `npm ci`, typecheck, lint, test and build with the CI placeholder env.
12. In CLAUDE.md, drop "not set up yet" and add `npm run build`. Write the progress entry. Run the verification agent, then open a PR for owner review.
**Risks:** Windows-made lockfile missing Linux binaries; Supabase local ports in Windows' reserved ranges; never use the MCP write tools (`.mcp.json` points at prod).
**Owner to-dos still open:** reset the DB password; in the Supabase dashboard, turn off sign-ups, add your user and put `{{ .Token }}` in the Magic Link email template (before step 2); decide read-only MCP.

## 2026-11-14: Launch step 1 (project skeleton)
**Status:** Done, pending owner review (PR 1, branch `feat/project-skeleton`)
**What was done**
- Next.js 16.4.6 / React 19.3 / Tailwind 4.3.3 scaffolded in a scratch dir and merged into the root. Minimal home page (h1 "JobTracker"), metadata title set, Geist font and boilerplate SVGs dropped (system font stacks in `globals.css`; no `public/` yet).
- shadcn/ui init (Radix base, new-york, neutral) + `button`. shadcn now ships its own `cn` package (`shadcn-ui/cn`) in place of clsx + tailwind-merge.
- `src/lib/status.ts`: the 9 PRD statuses as a literal tuple `STATUSES` (ready for `z.enum`), `STATUS_META` (label, kind; `satisfies Record<Status, …>` so a missing entry fails to compile), `ACTIVE_STATUSES`, `CLOSED_STATUSES`, `nextSuggestedStatus`. 5 Vitest tests.
- Vitest (`vitest.config.mts`), Playwright (Chromium, `tests/e2e/smoke.spec.ts`), `@supabase/supabase-js` + `@supabase/ssr` installed (unused until step 2).
- Local Supabase: `supabase init` + `start` (never linked), `enable_signup = false`, comment-only `seed.sql`, `db reset` clean, `npm run db:types` writes an ASCII file that typechecks (empty schema).
- `.env.local` from `npx supabase status` (local keys only, git-ignored; hook blocks it). `.env.example` now says "Copy to .env.local".
- CLAUDE.md commands no longer say "not set up yet"; added `npm run build`. Testing rule path now `vitest.config.mts`.
**Files:** `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `AGENTS.md`, `components.json`, `eslint.config.mjs`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `playwright.config.ts`, `src/app/{layout,page}.tsx`, `src/app/globals.css`, `src/app/favicon.ico`, `src/components/ui/button.tsx`, `src/lib/{utils,status,status.test}.ts`, `src/types/database.types.ts`, `supabase/{config.toml,seed.sql,.gitignore}`, `tests/e2e/smoke.spec.ts`, `.claude/CLAUDE.md`, `.claude/rules/testing.md`
**Checks:** from a clean `npm ci` (no `.next`, no `next-env.d.ts`): typecheck, lint, `npm test` (5/5), `npm run build` with the CI placeholder env all pass. `npm run test:e2e` 1/1. Lockfile has the Linux x64 binaries for next-swc, lightningcss and tailwind oxide.
**Decisions / defaults**
- shadcn base: Radix (react-hook-form + shadcn form components in D14 are documented against it).
- `@types/node` ^22 to match CI's Node 22.
**Follow-ups**
- Step 2 planning: `next.config.ts` has `cacheComponents: true`, which changes how `cookies()` and dynamic data are accessed (Suspense boundaries); account for it in the `@supabase/ssr` server client and `src/proxy.ts`.
- Owner to-dos from the plan entry are still open (DB password reset, dashboard sign-ups off + user + `{{ .Token }}` template before step 2, read-only MCP decision).

## 2026-11-14: Launch step 2 (Auth, F1)
**Status:** Done, pending owner review (PR 2, branch `feat/auth`)
**What was done**
- Supabase SSR clients in `src/lib/supabase/`: `server.ts` (request-bound with `connection()`, server-only), `client.ts` (browser) and `proxy.ts` (`updateSession`, which binds a client to the proxy's request and response cookies). All three read the public env vars through `env.ts`.
- `src/proxy.ts` calls `updateSession`, which refreshes the session with `getClaims()` on every non-static request. Signed-out users are sent to `/login?next=<path>`, and signed-in users who open `/login` are sent to `/`. The public routes are `/login` and `/auth/confirm` (`src/lib/auth-routes.ts`, which also has `loginUrl()` and `safeNextPath()`).
- `/login` has two steps, both Server Actions with shared Zod schemas, react-hook-form and the shadcn form. The email step calls `signInWithOtp` with `shouldCreateUser: false`; the code step calls `verifyOtp` with type `email` and then redirects to `safeNextPath(next)`. Unknown emails and other 4xx errors get the same "if this email has an account" answer. Actions return the shared `ActionResult` type (`src/lib/action-result.ts`).
- `/auth/confirm` exchanges the magic link's `token_hash` with `verifyOtp` and lands on `/`. A bad or used link goes to `/login?error=link`.
- The `(app)` layout shows the user's email and a Sign out button (`signOut({ scope: 'local' })`), with a minimal home page; the old root page moved there. `getCurrentUser()` in `src/lib/auth.ts` verifies with `getClaims()` and is deduplicated per request.
- Local Supabase: the Magic Link template has both the link and `{{ .Token }}` (`supabase/templates/magic_link.html`). `site_url` is now `http://localhost:3000`, localhost and 127.0.0.1 are allowed redirect URLs, OTP expiry is 900 seconds, and the local `email_sent` rate limit went from 2 to 100 so e2e runs don't hit it. Sign-ups stay off locally (`enable_signup = false`).
- `next.config.ts` turns off `logging.serverFunctions`, because dev printed emails and OTP codes.
- Dependencies: zod, react-hook-form and @hookform/resolvers (through the shadcn `form` component), and server-only. shadcn components: input, label, card, form.
- Tests: unit tests for `auth-routes` (public paths, `loginUrl`, open-redirect inputs including dot segments) and the auth schemas. Playwright covers four flows: a signed-out redirect that keeps `next`; code sign-in at 375px (wrong code, an off-site `next` of `/.//evil.example.com` ignored, no horizontal scroll, `/login` sends a signed-in user home, sign-out); magic-link sign-in where the link works only once and the stale link error clears; and an unknown email that gets the generic answer, no email and no account. Global setup creates fake users with the local admin API, and a guard refuses any non-local Supabase URL. `smoke.spec.ts` was removed because the auth spec covers it.
- Rules updated: auth.md, testing.md, ui.md and the CLAUDE.md rules table.
**Review fixes (same PR)**
- The security review found an open redirect: `safeNextPath` checked for `//` before URL normalization, so `/.//evil.example.com` came back as `//evil.example.com`. It now checks the normalized result. Fixed, with unit and e2e coverage (see learnings).
- Code-quality fixes: `OTP_LENGTH` is the single source for the code length; the server client is request-bound for every caller; the shared `ActionResult` type; dead `next` handling removed from `/auth/confirm`; query keys and `loginUrl()` shared; `supabaseEnv()` replaces non-null assertions; the stale link error clears after a new request; Mailpit helper checks responses; narration comments removed.
**Files:** `src/proxy.ts`, `src/lib/supabase/{server,client,proxy,env}.ts`, `src/lib/{auth,auth-routes,auth-routes.test,action-result}.ts`, `src/lib/schemas/{auth,auth.test}.ts`, `src/app/(auth)/login/{page,login-form,actions}.ts(x)`, `src/app/auth/confirm/route.ts`, `src/app/(app)/{layout,page,actions}.ts(x)`, `src/components/ui/{card,form,input,label}.tsx`, `supabase/config.toml`, `supabase/templates/magic_link.html`, `tests/e2e/{auth.spec,global-setup}.ts`, `tests/e2e/support/local-env.ts`, `playwright.config.ts`, `next.config.ts`, `package.json`, `package-lock.json`, `.claude/rules/{auth,testing,ui}.md`, `.claude/CLAUDE.md`, `docs/learnings.md`
**Checks:** typecheck, lint, `npm test` (48/48), `npm run build` with the CI placeholder env and no `.env.local`, and `npm run test:e2e` (4/4 against the local stack) all pass. The verification agent passed. The security reviewer found the open redirect fixed above, plus low-severity items handled below.
**Decisions / defaults**
- Both sign-in steps run as Server Actions, so validation and the "don't reveal accounts" mapping live on the server.
- Sign-out uses local scope, matching "ends the session on the device" in F1.
- The magic link always lands on `/`; only the code step follows `?next=`, because the email template has no per-request redirect. Fine for one user; revisit if deep links matter.
- A 429 rate-limit response also gets the generic "check your email" answer, so it can't reveal an account. The owner may then wait for an email that isn't coming. Only server or network failures show "couldn't send".
- Login errors are shown inline with `role="alert"`, not in a toast, since there is no toast library yet.
- Accepted risk: the magic link signs in on a plain GET, so someone could send the owner a link that signs the owner's browser into an attacker's account (login CSRF). Sign-ups are off and there is one user, so there is no second account to sign into.
**Follow-ups**
- Owner, prod dashboard (before the first prod sign-in, at step 9 at the latest):
  - Auth, Sign In / Providers: turn off "Allow new users to sign up".
  - Auth, Users: add the owner's user, auto-confirmed.
  - Auth, Email Templates, Magic Link: link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and show `{{ .Token }}` (copy `supabase/templates/magic_link.html`).
  - Auth, Email provider: OTP length 6 and OTP expiry 900 seconds.
  - Auth, Rate Limits: confirm the email and verification limits are sensible.
  - Auth, URL Configuration: Site URL is the Vercel production URL; redirect URLs are `<prod URL>/**`.
  - Consider custom SMTP; the built-in sender is heavily rate-limited.
- Deferred to step 4: a reusable `signInAs(page, email)` e2e fixture (admin `generateLink` plus `storageState`), built with the first signed-in flow.
- Still open from step 1: DB password reset and the read-only MCP decision.

## 2026-11-14: Launch step 3 (Schema)
**Status:** Done, pending owner review (branch `feat/schema`). Applied to the local stack only; nothing pushed to prod.
**What was done**
- Eight migrations, one table or helper each, with its grants, RLS and triggers (all verified with `npx supabase db reset`):
  - `20261115014501_create_private_helpers`: unexposed `private` schema (no client usage, execute revoked by default) and `private.set_updated_at()`.
  - `20261115014503_create_profiles`: `profiles` (id = auth user; `time_zone` nullable, no default), RLS select/update own, `authenticated` may only `update (time_zone)`; `private.validate_time_zone()` trigger for non-null values (`invalid_time_zone`, errcode 22023) against `pg_timezone_names`; security definer `private.handle_new_user()` trigger on `auth.users`; backfills profiles for existing users (the owner on prod).
  - `20261115014504_create_applications`: all PRD columns; `unique (id, user_id)` for the children's composite FKs; checks for status (= `STATUSES`), work_mode, non-blank company/role, `http(s)` job_url, salary >= 0 and min <= max, ISO currency (default USD), text lengths; per-operation RLS; column-level insert/update grants on content columns; updated_at trigger; `private.set_date_applied()` trigger (F4).
  - `20261115014506_create_status_events`: select-only table (writes revoked from anon, authenticated and service_role); `(application_id, user_id)` composite FK; `changed_at default clock_timestamp()`; security definer `private.log_status_event()` with `after insert` and `after update of status when (old.status is distinct from new.status)` triggers.
  - `20261115014508_create_notes`, `20261115014510_create_contacts` (http(s) linkedin_url), `20261115014512_create_interviews` (kind, outcome, 1-1440 minute duration checks): `(application_id, user_id)` composite FK to applications; contacts and interviews also `unique (id, application_id)`; text lengths; per-operation RLS on `user_id`; column grants (no `application_id` update).
  - `20261115014513_create_interview_contacts`: join rows (unique per user, interview and contact) carrying `application_id`, with composite FKs to the application (same user), the interview and the contact (same application); select/insert/delete only.
- Grants: every table does `revoke all from anon, authenticated`, then grants `authenticated` select/delete plus column-level insert/update on content columns. Clients can't write `id`, `user_id`, timestamps, or a child's `application_id` after insert.
- Ownership columns: `user_id` FK to `auth.users` + index on every table except `profiles` (its `id` is the user). `status_events.user_id` has no default (trigger-only). Composite FK columns are indexed.
- `src/lib/closed-sets.ts` (`WORK_MODES`, `INTERVIEW_KINDS`, `INTERVIEW_OUTCOMES`) and `src/lib/limits.ts` (`TEXT_LIMITS`). `src/lib/check-constraints.test.ts` parses the migrations and checks the closed-set and length constraints match the TS constants (step 1 follow-up).
- RLS suite `tests/rls/rls.test.ts` (`npm run test:rls`, separate `vitest.rls.config.mts`), 29 tests with two fake users:
  - cross-user read/update/delete on every table; inserts under the other user's parent; `user_id` spoof on insert and update; upsert of the other user's application id; links under the wrong user or with the other user's contact; anon denied everywhere
  - re-parenting notes, contacts and interviews fails; a link to a contact from another application fails; links can't be updated; profile id can't change
  - private functions unreachable over `/rest/v1/rpc` (with and without `Content-Profile: private`)
  - status_events: client writes denied (own rows included); trigger logs the initial status and each change, not no-ops
  - profile created with null time zone; valid zone accepted, bad zone rejected
  - date_applied set to today in the owner's zone on insert as applied and on saved to applied; an explicit date is kept
  - every status accepted; bad closed-set, salary, currency, URL and length values rejected; application delete cascades children and history
- Regenerated `src/types/database.types.ts` (ASCII).
**Review fixes (same PR, after verification PASS and security review SAFE)**
- Security re-review (SAFE): `interview_contacts` unique key now leads with `user_id`, with insert and upsert tests for a forged existing pair.
- Column-level grants; composite FKs replace the policies' `exists` parent checks; `clock_timestamp()` for `changed_at`; text length limits mirrored in `limits.ts`; nullable `profiles.time_zone`; the F4 date_applied trigger; more attacker-side tests; narration comments removed; rules updated (database.md, testing.md, ui.md).
**Files:** `supabase/migrations/*.sql` (8), `src/types/database.types.ts`, `src/lib/{closed-sets,limits,check-constraints.test}.ts`, `tests/rls/rls.test.ts`, `vitest.rls.config.mts`, `package.json`, `.claude/CLAUDE.md`, `.claude/rules/{database,testing,ui}.md`, `docs/learnings.md`
**Checks:** `npx supabase db reset` clean; typecheck, lint, `npm test` (53/53), build with CI placeholder env, `npm run test:e2e` (4/4), `npm run test:rls` (29/29). Mutation checks: weakening the notes insert policy, dropping the status trigger's no-op guard, granting `update (application_id)` on notes and dropping the date_applied trigger each made the RLS suite fail. Local advisors (`npx supabase db advisors --type all --level info`): only `unused_index` INFO on the empty DB (expected); `npx supabase db lint --schema public,private`: no errors. Supabase MCP not used (points at prod).
**Decisions / defaults**
- Default currency USD (PRD default); follow-ups are `date`, interviews `timestamptz` (PRD default).
- `interviews.interviewers` (free text) added: F7 allows interviewers as free text, which the data model had no column for. `interviews.scheduled_at` is required.
- F4 "setting status to applied with no date applied sets it to today" is a `before insert or update of status` trigger (`private.set_date_applied`, invoker rights) using the owner's `profiles.time_zone`, falling back to UTC. It's in the database for the same reason as D5: no code path can skip it. It isn't a transition check, so D6 holds, and clients can still set `date_applied` explicitly. New applications default to `saved`; F2's "start in applied if a date applied is set" stays in the step 4 Server Action.
- `profiles.time_zone` is nullable with no default, so step 7 can tell "never detected" (null) from a chosen UTC.
- Text length limits (defence against oversized writes): 200 for short fields (500 for `follow_up_note` and `interviewers`, 320 for email), 2048 for URLs and `interviews.location`, 20000 for long text.
- `status_events` has no check on from/to status (only the trigger writes it, copying a checked value), so renaming a status touches one constraint.
- No stats views yet (step 8, D13). No seed rows: tests create their own users and data.
- `interview_contacts` is unique on `(user_id, interview_id, contact_id)`. With the pair alone, the unique check (which runs before the FKs) let someone who knew both of another user's UUIDs learn whether they were linked. The security re-review found this and it's closed: a forged pair now always fails the FK (23503).
**Follow-ups**
- Prod push of these 8 migrations is an owner-approval item for step 9 (`supabase link` + `db push`).
- Step 4: Zod schemas must mirror the DB checks (non-blank company/role, http(s) URLs, salary rules, currency `^[A-Z]{3}$`, `TEXT_LIMITS`); map `invalid_time_zone`, 23503 and 23514 to user-facing copy. Use `z.enum(STATUSES)` (`ACTIVE_STATUSES` is `readonly Status[]`, not a tuple). Add WORK_MODE / INTERVIEW labels to `closed-sets.ts` when the forms need them.
- Step 6: decide whether interviews need a time zone column (today `scheduled_at` is an instant, shown in the owner's zone). Render `interviews.location` as a link only if it is http(s) (ui.md).
- Step 7: detect the browser time zone on first sign-in when `profiles.time_zone` is null; server code falls back to UTC.
- Step 8: stats views return raw facts ordered by `changed_at`; classify statuses (active/closed, "screening or later") in TS from `status.ts`, not hard-coded status lists in SQL.

## 2026-11-14: Launch step 4 (Applications CRUD F2 + status changes F4)
**Status:** Done, pending owner review (PR 4, branch `feat/applications-crud`). No migration; nothing touched prod.
**What was done**
- Routes:
  - `/` lists applications (company, role, status, Archived badge). Archived ones are hidden unless "Show archived" (`?archived=1`). Step 5 replaces this list.
  - `/applications/new`, `/applications/[id]` (detail), `/applications/[id]/edit`.
  - Data reads sit inside `<Suspense>` (Cache Components) and go through `src/lib/application-queries.ts` (server-only). Every query filters by `user_id` on top of RLS. `getApplicationOrNotFound` validates the id and calls `notFound()` for a bad, missing or foreign id. Stored `status` / `work_mode` are narrowed to `Status` / `WorkMode` once there (safe by the check constraints and check-constraints.test.ts).
- Server Actions (`src/app/(app)/applications/actions.ts`). Each re-checks the user and parses with the shared Zod schema (`parseOr`). None writes `status_events`, and they write only granted content columns.
  - `createApplication`: inserts with status `applied` when a date applied is set, else `saved`; revalidates `/` and redirects to the detail page.
  - `updateApplication` (bound to the id by the edit page), `changeStatus`, `setArchived({ id, archived })`: go through `updateOwnApplication`, which filters by `user_id`, maps "no row returned" to `APPLICATION_NOT_FOUND` and DB errors to `writeErrorMessage()`. They revalidate `/` and the detail path.
  - `deleteApplication`: goes through `deleteOwnApplication` (same mapping); children and history cascade; revalidates `/` and redirects there.
- Validation (`src/lib/schemas/application.ts`) mirrors the DB checks: non-blank company/role, `TEXT_LIMITS`, http(s) `job_url` (also `URL.canParse`), whole non-negative salaries up to the int4 max (commas allowed), min <= max, a 3-letter uppercase currency code (input upper-cased), `WORK_MODES`, real `YYYY-MM-DD` dates. Blanks become null. `statusChangeSchema` uses `z.enum(STATUSES)`; `archiveSchema` takes a uuid and a boolean.
- Detail page:
  - Status badge and all fields: salary via `formatSalaryRange`, dates via `src/lib/dates.ts`, job link with `rel="noopener noreferrer"`. Description.
  - Status control: select plus "Change status", and "Move to <next>" from `nextSuggestedStatus`. Both go through `useChangeStatus()` (reusable by the step 5 board).
  - Archive/Unarchive, and Delete behind an AlertDialog.
  - Status history, newest first, in `profiles.time_zone` via `getTimeZone()` (UTC fallback).
- The edit form remounts on `updated_at` (`key`), so the hidden, still-mounted edit route never shows values from before a change made elsewhere (see learnings).
- Client results show through `toastResult()` (`src/lib/toast-result.ts`, sonner).
- Other helpers: `src/lib/applications.ts` (`Application` type, `APPLICATION_NOT_FOUND`, `initialStatus`, `toFormValues`, `EMPTY_APPLICATION_FORM`, `formatSalaryRange`, paths), `src/lib/dates.ts`, `src/lib/db-errors.ts`, `src/lib/profile.ts`, `isStatus` in `status.ts`, `WORK_MODE_LABELS` in `closed-sets.ts`, `src/components/status-badge.tsx`.
- shadcn: textarea, native-select, alert-dialog, badge, sonner (adds `sonner` and `next-themes`; repos and maintainers checked). `<Toaster />` is in the root layout.
- Rules updated: ui.md, testing.md, server-actions.md, database.md (renaming a status must migrate `status_events` rows). Learnings: hidden routes in e2e, stale form state, zodResolver raw mode, escape sequences decoded by Edit and heredocs.
**Tests**
- Unit: schema (every mirrored check, `statusChangeSchema`, `archiveSchema`), application helpers, dates, `isStatus`.
- E2E fixture `signInAs(email, page?)` (`tests/e2e/support/fixtures.ts`): admin `generateLink` and `/auth/confirm`, after deleting that user's applications.
- E2E `tests/e2e/applications.spec.ts`:
  - At 375px: create (validation errors first), edit, Edit then Cancel, "Move to Applied" (history and date applied = today), Edit again shows that date and saving keeps it, any-status change, archive / hidden / show archived / unarchive, delete with cancel then confirm, 404 after delete, no horizontal scroll.
  - A date applied on create starts in Applied; the next "New application" form is blank.
  - A second signed-in user opening another user's `/applications/<id>` and `/edit` gets the not-found page and none of the data.
- `auth.spec.ts` now expects the "Applications" heading.
**Checks**
- typecheck, lint, build with the CI placeholder env: pass.
- `npm test`: 76/76. `npm run test:e2e`: 7/7 (4 auth, 3 applications). `npm run test:rls`: 29/29.
- Removing the edit form's `key` makes the e2e fail (checked).
- Verification agent: PASS. Security reviewer: SAFE (live IDOR, CSRF and mass-assignment probes all blocked). Code-quality review: five passes, findings applied in a second commit.
**Decisions / defaults**
- Default currency USD (PRD default), editable per application; follow-ups are date-only (PRD default).
- Status isn't on the create/edit form: F2 sets the initial status, F4 changes it on the detail page. Editing date applied later doesn't change status.
- The status select applies on an explicit "Change status" button (keyboard arrowing through a native select fires `change` per option). `accepted` and the other closed statuses show no "Move to" suggestion.
- Archive needs no confirmation; delete does (ui.md). Archived applications stay reachable by URL and from "Show archived".
- Salary input accepts commas ("120,000") and stores an integer.
- Action errors show as toasts (ui.md); field errors inline.
**Follow-ups**
- Step 5: replace the home list with table and board (reuse `listApplications`, `StatusBadge`, `useChangeStatus`). Decide where "days in current status" comes from (a view/RPC or a second query) before building the board.
- Step 6: lift `updateOwnApplication` / `deleteOwnApplication` to a table-generic helper for notes, contacts and interviews. Keep the detail page's fetches in one `Promise.all` and split its sections into small server components.
- Step 7: detect `profiles.time_zone`; until then the detail page shows times in UTC. Re-add the `22023` (invalid time zone) case to `writeErrorMessage` with the settings form.
- Cosmetic: `notFound()` inside Suspense streams the not-found UI with HTTP 200.

## 2026-11-14: Launch step 5 (Pipeline views, F3)
**Status:** Done, pending owner review (PR 5, branch `feat/pipeline-views`). Review fixes applied 2026-11-15. No migration; nothing touched prod.
**What was done**
- Routes:
  - `/applications` is the pipeline: Board (default) and Table (`?view=table`), switched by a two-link nav with `aria-current`. It replaces step 4's home list.
  - `/` redirects to `/applications` (`src/app/(app)/page.tsx`), so step 7 can put the reminders home page there by replacing that one file. The redirect runs at request time behind `<Suspense>` and `connection()` (see learnings).
  - The signed-in shell (header and main) is `max-w-7xl`, so five board columns fit at 1280px. The detail page caps itself at `max-w-5xl`; the forms already cap at `max-w-3xl`.
- Data:
  - `listPipeline()` in `src/lib/application-queries.ts` (replaces `listApplications`) reads every application, archived included, in one query.
  - The query and its row mapping live in `src/lib/pipeline-query.ts` (`selectPipeline`, `toPipelineItems`), outside `server-only`, so the local-stack suite runs the real query. It embeds each application's newest `status_events.changed_at` (`.order` and `.limit(1)` with `referencedTable`), so "days in current status" needs no view, RPC or migration.
  - `getToday()` in `src/lib/profile.ts` gives today in `profiles.time_zone` (UTC fallback), cached per request. The page fetches items, today and the time zone with one `Promise.all`.
- Pure logic, all unit-tested:
  - `src/lib/pipeline.ts`: `compareBoardCards`, `boardColumns`, `countClosed`, `filterApplications`, `sortApplications`, `nextSort`, `formatDaysInStatus`. `PipelineItem` is a `Pick` of `Application` plus `days_in_status`.
  - `src/lib/follow-ups.ts`: `followUpState`, with `<FollowUpBadge>` in `src/components/` for step 6 and 7 to reuse.
  - `dates.ts`: `DateOnly`, `dateInTimeZone`, `daysBetween`. `closed-sets.ts`: `isWorkMode`. `applications.ts`: `APPLICATIONS_PATH` and the view helpers.
- Board (`pipeline-board.tsx`):
  - `@dnd-kit/core` 6.3.1. I checked the package: repo clauderic/dnd-kit, maintainer clauderic.
  - One droppable column per active status, with a `DragOverlay` the size of the card. The mouse sensor starts after 8px; the touch sensor starts on a 250ms long press, so a swipe still scrolls.
  - "Show closed (n)" adds the closed columns. Archived cards never show on the board.
  - Cards show company, role, days in status, and the next follow-up with an Overdue or Due today badge (text, not colour only).
  - Each card has a Move menu (a Radix radio menu with every status). It is the keyboard and screen reader path.
  - Moves go through `useChangeStatus(setOptimistic)` with `useOptimistic`. A failed move rolls back and shows the action's error. A move that can't reach the server shows "Couldn't reach the server. Try again." and rolls back, instead of crashing to the error screen.
  - Custom dnd-kit announcements use company and status labels instead of ids.
- Table (`pipeline-table.tsx`):
  - Sortable headers (buttons with `aria-sort`) for company, role, status (lifecycle order), date applied (blanks last) and last updated (a date in the owner's zone).
  - Filters for status, work mode and "Show archived", and search over company and role (case-insensitive, trimmed). A `role="status"` line shows the result count.
  - Filter state is client state (kept while the route stays mounted), not in the URL.
- Actions call one `revalidatePipeline()` (plus the detail path where it applies) and redirect to `/applications`.
- `src/app/(app)/error.tsx`: a plain "Something went wrong" page with Try again, as a safety net for unexpected errors. It doesn't log the error.
- shadcn: dropdown-menu, table, checkbox.
**Tests**
- Unit: board order, columns, `countClosed`, filters, sorting, labels, `followUpState`, view helpers.
- Unit: `dateInTimeZone` across zones and the US DST change; `daysBetween` across DST and leap days.
- Local stack: `tests/rls/pipeline-query.test.ts` runs `selectPipeline` as a signed-in user. It backdates two applications' first status events through the local superuser, changes one status, and checks that each row embeds only its newest event and that days in status are 0 and 10. Dropping `referencedTable` from the `.limit` makes it fail (checked). The RLS suite's sign-in helpers moved to `tests/rls/support.ts`.
- E2E `tests/e2e/pipeline.spec.ts`, with fake data from the new `seedApplications` helper and 5 new test users:
  - Table: default order, every sortable column, the status, work mode and archived filters, search, and an empty result.
  - Board: all active columns shown and fitting at 1280px; closed and archived hidden; "Show closed" toggles Rejected; automatic order; the Overdue, Due today and no-follow-up labels.
  - Keyboard: a move through the Move menu persists after reload, and history shows "Applied → Screening".
  - Drag and drop: a mouse drag from Saved to Screening persists after reload and logs history. The whole pipeline spec passed three repeats with no flakes (`--repeat-each=3 --workers=1`; parallel repeats share each test's user and delete each other's rows).
  - Rollback: the test deletes the row directly through the admin client and holds the Server Action request. The card shows in Offer first, then returns to Saved with "That application no longer exists." when the request goes through.
  - Network failure: with the action request aborted, the card returns to Saved, the toast says the server couldn't be reached, and the page stays up. Without the try/catch this test fails (checked).
  - 375px: neither view scrolls the page sideways; the board scrolls in its own container.
- `applications.spec.ts`: a second user's `/applications` and `?view=table` show the empty state and none of the first user's text. It and `auth.spec.ts` also moved to `/applications`.
**Checks:** typecheck, lint, `npm test`, build with the CI placeholder env, `npm run test:e2e`, `npm run test:rls` (run on its own): all pass. Counts are in the PR. The browser console is clean on the board, table and detail pages.
**Decisions / defaults**
- Days in status come from the embedded newest status event (no migration), counted as calendar days in the owner's zone; 0 shows "In status since today".
- The board is the default view (F3's first bullet, "see at a glance"); the table is `?view=table`.
- Closed statuses are filtered out of the board by default; "Show closed (n)" adds their columns, which accept drops too. Archived applications appear only in the table, behind "Show archived" (D10).
- Board order sorts by follow-up date, so overdue cards come first without a separate check. Cards with no follow-up come after all dated ones.
- The table defaults to last updated, newest first. A new sort column starts A–Z for text and newest first for dates.
- No status change from the table; rows link to the detail page.
- The pipeline loads every application once and filters on the client (fine at the PRD's 500; PostgREST's default max rows is 1000).
- The signed-in shell is `max-w-7xl` so the board fits five columns at 1280px. Below that the board scrolls inside its own container, as before.
**Follow-ups**
- Step 7: replace `src/app/(app)/page.tsx` with the reminders home page and add `/` to `revalidatePipeline()`. Use `getToday()` and `<FollowUpBadge>`.
- A board left open past midnight keeps the server's "today" until the next refresh (D11). Acceptable.
- Step 8: average days per stage needs its own `status_events` query; the pipeline query only embeds the newest event.
- Over 1000 applications the pipeline query would hit PostgREST's row cap; paginate or filter server-side then.

## 2026-11-15: Launch step 6 (Detail page: notes, contacts, interviews, F5–F7)
**Status:** Done, pending owner review (PR 6, branch `feat/detail-sections`). Review fixes applied 2026-11-15. No migration; nothing touched prod.
**What was done**
- `/applications/[id]` now has Interviews, Contacts, Notes and Status history sections.
- The page fetches history, notes, contacts, interviews and the time zone in one `Promise.all`. Each section is a small server component in `[id]/sections.tsx`; the forms are client islands (`notes.tsx`, `contacts.tsx`, `interviews.tsx`) built on `[id]/section-ui.tsx`.
- Notes (F5): add, inline edit, delete with confirm. Newest first, with "Added" and "Edited" times in the owner's zone. The add form clears after saving.
- Contacts (F6): name (required), role or title, email, phone, LinkedIn URL and notes. Add, inline edit, delete with confirm. Email and phone are `mailto:` / `tel:` links; LinkedIn opens with `rel="noopener noreferrer"`.
- Interviews (F7): type, date and time, duration, location or video link, interviewers, outcome and notes. Add, inline edit, delete with confirm.
  - Interviewers are checkboxes over the application's contacts (stored in `interview_contacts`) plus free text (`interviews.interviewers`).
  - Location is a link only when it's an http(s) URL.
  - Adding the first interview while Applied or Screening shows "Move the application to Interviewing?" with a button and "Not now". The banner only shows while the current status is still Applied or Screening. Nothing changes on its own.
- Server Actions in `[id]/actions.ts`. Each one parses the id and input with `parseRequest`, which re-checks the user and uses Zod schemas that mirror the DB checks and `TEXT_LIMITS`. Actions write only granted columns, map errors with `writeErrorMessage` and revalidate the detail page.
- `src/lib/owned-rows.ts` holds every owned-row write: applications plus `insertChild` / `updateOwnChild` / `deleteOwnChild`. Not-found messages come from the table (`NOT_FOUND`).
- `src/lib/stored.ts` is the one place stored closed-set text becomes `Status` / `WorkMode` / `InterviewKind` / `InterviewOutcome`.
- `dates.ts`: `localDateTimeToInstant`, `instantToLocalDateTime` (DST-aware), `startOfDayInstant`, `formatDateTimeWithZone`. `follow-ups.ts`: `interviewDueState`.
- For step 7: `listUpcomingInterviews({ from, until })` takes owner-zone dates and returns pending rounds on unarchived applications, soonest first. `[id]/actions.ts` has `INTERVIEW_LIST_PATHS` for the pages to revalidate on interview writes.
**Tests**
- Unit (133): note, contact and interview schemas (every mirrored check, the 1900–2999 year range, the 50-interviewer cap); zone conversion across zones, midnight and the US DST gap and overlap; `startOfDayInstant`; `interviewDueState`; detail helpers; `isHttpUrl`; `suggestsInterviewing`.
- Local stack: `tests/rls/upcoming-interviews.test.ts` (2 tests: range bounds, outcome and archived filters, order; another user's rows never returned).
- E2E `tests/e2e/detail.spec.ts`, main flow at 375px: add, edit and delete a note, a contact and an interview with a picked contact interviewer; validation messages; reload keeps everything; no horizontal scroll; no browser console errors or warnings.
- E2E, interview cases: the Interviewing suggestion and its history entry; changing interviewers; deleting a contact removes it from a round; a contact deleted while the Add or the Edit form is open doesn't stop the save. Without the client filter that last case fails (checked).
- E2E, isolation: a second user gets the not-found page and none of the owner's notes, contacts or interviews.
**Checks:** typecheck, lint, `npm test` (133), build with the CI placeholder env, `npm run test:e2e` (14/14), `npm run test:rls` (32/32). Verification PASS; security review SAFE (live cross-user probes refused); five code-quality passes applied.
**Decisions / defaults**
- Interview time zone: PRD default "interviews use `timestamptz`", so no time zone column and no migration. The form's date and time are read in the owner's `profiles.time_zone` (UTC until step 7) and shown with the zone's short name ("10:00 AM EST"). A time skipped by DST keeps the earlier offset (2:30 becomes 3:30); a repeated time takes its first occurrence. Years are limited to 1900–2999.
- Notes are stored as typed and shown as plain text with line breaks kept. Markdown is not rendered.
- Contacts are listed in the order added, interviews in schedule order, notes newest first (F5).
- Email must look like an email address when given (Zod only; the DB checks length only). Phone is free text.
- Deleting a contact removes it from the interviews it was picked on (FK cascade); the interview stays. The confirm dialog says so.
- Interviewer links are written after the interview row, so the writes aren't atomic. On add, a failed link insert deletes the new interview, and revalidates if that delete fails so a leftover row shows. On edit, the other field changes stay saved and the error toast shows.
- On edit, links not in the new set are deleted and the set is upserted with `ignoreDuplicates`. This works with the column-level insert grant (checked on the local stack).
- Interviewers picked from contacts are capped at 50.
- Upcoming interviews for F8: pending outcome only, archived applications excluded.
**Follow-ups**
- Step 7: add `/` to `INTERVIEW_LIST_PATHS`; use `listUpcomingInterviews` and `interviewDueState`.
- Atomic interview + links write as an RPC (needs a migration and a security review).
- Move `TextField`, `ConfirmDeleteButton` and the action hook to a shared module. Rebuild the application form's `TextField`, `DeleteButton`, `useChangeStatus` and `ArchiveButton` (which doesn't catch rejections) on them.
- Move the contact and interview form-value mappers next to their schemas.
- E2E only runs in UTC; time-zone conversion is covered by unit tests. Add a desktop-width run of the detail flow.

## 2026-11-15: Launch step 7 (Reminders home page, F8)
**Status:** Done, pending owner review (PR 7, branch `feat/reminders-home`). Review fixes applied 2026-11-17. No migration; nothing touched prod.
**What was done**
- `/` is now the reminders home page and replaces the step 5 redirect. It has three lists: Overdue, Today and Next 7 days. Each combines follow-ups and pending interviews, bucketed in the owner's `profiles.time_zone` (D11). Each list is a labelled region with a count and an empty message. A line under the heading says "Today is <date> in <zone>" and links to settings.
  - Follow-up items: a Follow-up label, status badge, company and role (linking to the detail page), the date with "3 days overdue", "Today", "Tomorrow" or "In 4 days", the note, and a Mark done button.
  - Interview items: an Interview label, kind, status badge, company and role, time with zone, duration, and location (a link only if http(s)). Overdue rounds say "Outcome not recorded yet".
- Mark done opens a dialog titled "Mark follow-up done", prefilled with the date 7 days out and the current note.
- Saving with a date sets the next follow-up. Saving with a blank date clears the follow-up and its note in one step. It's one `completeFollowUp` action and one update of `next_follow_up_on` and `follow_up_note`.
- Time zone (F8, D11):
  - Detection: the `(app)` layout renders `<TimeZoneDetector />` only while `profiles.time_zone` is null. It sends the browser's zone to `detectTimeZone`, which updates only where the zone is still null and then revalidates every page, so the open page re-renders in the owner's zone. A failed profile read in the layout skips detection instead of breaking the shell.
  - `/settings`: a select of Intl's zones plus UTC and the saved zone. `updateTimeZone` (in `settings/actions.ts`) saves it and revalidates every page, and skips both when the zone didn't change.
  - Validation: Zod `isSupportedTimeZone` (an IANA-shaped name Intl can format in; offsets like `+05:00` are rejected), then the DB trigger. A 22023 error shows "That time zone isn't recognized. Pick another one." from `src/lib/profile-writes.ts`.
  - A stored zone that Postgres accepts but Intl can't format in (such as `Factory`) falls back to UTC on every page (`effectiveTimeZone`), and settings asks the owner to pick another.
- Main nav in the header: Reminders, Applications, Settings (a second row below `sm`). Sign-in lands on `/` by every path: the code, the magic link, the `safeNextPath` fallback, and `/login` while signed in.
- Data: `reminderWindow(today)` returns one half-open bound, `untilDay`. `listDueFollowUps(untilDay)` (`src/lib/reminder-query.ts`) and `listUpcomingInterviews(untilDay)` have no lower bound, so every pending past round shows as overdue. `bucketReminders` classifies days with `followUpState`; `interviewDueState` was removed.
- Revalidation is all in `src/lib/revalidate.ts`: `revalidateApplicationLists` (renamed from `revalidatePipeline`; now includes `/`), `revalidateApplication`, `revalidateApplicationChild` (adds `/` for interviews) and `revalidateAllPages`.
- `section-ui.tsx` moved to `src/components/`, and `useSectionForm`'s `onDone` is optional. shadcn `dialog` added.
**Files:** `src/app/(app)/{page.tsx,layout.tsx,actions.ts,follow-up-done.tsx,time-zone-detector.tsx}`, `src/app/(app)/settings/{page.tsx,time-zone-form.tsx,actions.ts}`, `src/app/(app)/applications/{actions.ts,[id]/actions.ts,[id]/contacts.tsx,[id]/interviews.tsx,[id]/notes.tsx}`, `src/components/section-ui.tsx` (moved), `src/components/ui/dialog.tsx`, `src/lib/{reminders,reminder-query,revalidate,time-zones,profile,profile-writes,dates,follow-ups,owned-rows,interview-query,application-queries,auth-routes}.ts`, `src/lib/schemas/{follow-up,settings}.ts`, unit tests beside them, `tests/rls/reminder-query.test.ts`, `tests/e2e/{home,auth,applications}.spec.ts`, `tests/e2e/support/{fixtures,local-env}.ts`, `playwright.config.ts`, `.claude/rules/{ui,server-actions,testing,database}.md`, `docs/learnings.md`
**Tests**
- Unit: bucketing (day 7 in and day 8 out; interviews split at midnight in the owner's zone, not UTC; the US fall-back day; Auckland, Kiritimati and Pago Pago across the date line; ordering), `reminderWindow` across month, year and leap boundaries, `addDays`, `formatDueIn`, `startOfDayInstant` on Santiago's midnight-skipping DST day, the follow-up and time-zone schemas, `isSupportedTimeZone`, `effectiveTimeZone`, `timeZoneOptions`.
- Local stack (`tests/rls/reminder-query.test.ts`): due follow-ups (the exclusive `untilDay`, overdue included, archived and unset excluded, closed status included, order). Another user's follow-ups are never returned, even when queried with the owner's id, and another user can't clear the owner's follow-up. Interviews with no lower bound include old pending rounds only.
- E2E `tests/e2e/home.spec.ts`:
  - At 375px, seeded follow-ups and interviews land in the right lists. Archived, passed and day-8 items are excluded; a rejected application's follow-up is kept. Links work and the page doesn't scroll sideways.
  - Mark done sets the next one (the date 7 days out is prefilled), then a blank date clears the follow-up and its note in one step, checked in the database.
  - With Playwright `timezoneId: "Pacific/Pago_Pago"`, the open page switches to that zone right after sign-in, without a reload. Changing to Kiritimati in settings moves the buckets, and detection doesn't overwrite it on reload.
  - A second user sees empty lists and none of the owner's text.
  - The buckets, Mark done and time zone tests (home page, dialog and settings) assert no browser console errors or warnings.
  - `signInAs` now clears the profile's zone and ends on `/`; Playwright runs in `timezoneId: "UTC"`.
**Checks:** typecheck, lint, `npm test`, build with the CI placeholder env, `npm run test:e2e`, `npm run test:rls` (run on its own): all pass; counts are in the PR. Verification PASS and security review SAFE (live cross-user probes refused) on the first version; five code-quality passes applied in the second commit.
**Decisions / defaults**
- Lists: Overdue covers any day before today, with no lower bound. Next 7 days runs from tomorrow through 7 days out. Interviews fall on their calendar day in the owner's zone, so an interview earlier today stays in Today.
- Archived applications are excluded (the PRD hides them from lists by default).
- Closed statuses are not excluded: the PRD doesn't say to hide them, and a follow-up the owner set is a reminder they asked for. This matches step 6's `listUpcomingInterviews` (pending only, archived excluded). Flagged for the owner.
- Interviews count while their outcome is pending. A past pending round shows under Overdue until an outcome is recorded on the detail page. The home page has no interview actions (the PRD lists none).
- Order within a list: by day first. On the same day, interviews come first by time, then follow-ups by company and role.
- Mark done suggests the next follow-up 7 days out (the PRD's example) and keeps the note by default. There is no separate snooze or reschedule action (not in the PRD); the date can be changed in the dialog or the edit form.
- Detection runs on the first signed-in page load while the zone is null (the PRD's "first sign-in"), not in the sign-in action, so the code and magic-link paths behave the same. A zone the server rejects is ignored silently, and UTC stays until one is picked in settings.
- `isSupportedTimeZone` doesn't require Intl's resolved name to match the input: Intl resolves aliases (`Asia/Kolkata` to `Asia/Calcutta`), so that check would reject valid names.
**Follow-ups**
- A page left open past midnight keeps the server's "today" until the next refresh (same as the board, D11).
- Deferred from review: rebuild the application form on the shared form pieces and split `section-ui.tsx` into form fields and the editable row; optionally rename `reminder-query.ts` to `follow-up-query.ts`; reject Intl-unsupported zone names in the database (next migration); no rate limit on settings writes.

## 2026-11-17: Launch step 8 (Stats dashboard, F9)
**Status:** Done, pending owner review (branch `feat/stats`). One new migration, applied to the local stack only; nothing touched prod.
**What was done**
- Migration `20261118025658_create_stats_functions` (D13) adds four `stable security invoker` functions with `set search_path = ''`. Each filters `user_id = (select auth.uid())`, with RLS on top. Execute is revoked from public, anon and service_role and granted to authenticated only. No status value appears in the SQL, and nothing reads `now()` or `current_date`.
  - `stats_status_counts(include_archived)`: applications per current status.
  - `stats_applied_per_day(from_day, until_day, include_archived)`: applications per `date_applied` in the half-open `[from_day, until_day)` window.
  - `stats_response_counts(reached_statuses, responded_statuses, include_archived)` (plpgsql): applications whose history ever reached a status in the first list, and how many of those ever reached one in the second. The lists come from `RESPONSE_RATE_STATUSES` in `status.ts`. More than 32 entries in either list raises `too_many_statuses` (22023).
  - `stats_stage_durations(include_archived)`: completed stays per status, using `lead(changed_at)` over each application's events ordered by `changed_at`, with `id` breaking ties. Returns the stay count and the average elapsed days.
- `/stats` page, with a "Stats" nav link:
  - An "Include archived applications" checkbox (`?archived=1`).
  - Applications by status: a table of the Active and Closed groups, with counts, bars and a total.
  - Response rate: a percent plus "x of y".
  - Applications per week: a shadcn/Recharts bar chart with a text total, an `aria-label` and a "Show as table" table.
  - Average days in each stage: a table.
  - With nothing to count, an empty state ("No applications to count yet.") replaces the sections.
- `src/lib/stats.ts` holds the pure helpers: `statsWindow(today)`, `toStatusCounts`, `toWeekCounts`, `toResponseRate`, `toStageDurations`, `formatDays`, the `?archived` param helpers and `STATS_PATH`. `src/lib/stats-query.ts` (outside server-only) runs the four RPCs and maps their rows to camelCase. `getStats(includeArchived)` in application-queries.ts passes in `getToday()`.
- `dates.ts`: `startOfWeek` (Monday) and `formatMonthDay`, plus a private `utcDate` that the date-only helpers share. `status.ts`: `forwardPathFrom`, `RESPONSE_RATE_FROM` (the two starting statuses) and `RESPONSE_RATE_STATUSES` built from them. The page's response-rate labels also come from `RESPONSE_RATE_FROM`.
- Stats marks take one colour, `STATS_MARK_COLOR` (`var(--chart-2)`) in `stats/chart-color.ts`.
- `revalidateApplicationLists()` now also revalidates `/stats`.
- shadcn `chart` added. It brings in `recharts` 3.8 (repo recharts/recharts; maintainers checked). `react-is` is pinned to 19.3.0 to match React, because the hoisted 16.x that recharts would otherwise use doesn't recognise React 19 elements.
- E2E fixture fix: `signInAs` now waits until the browser's zone is saved and the network is idle. Detection's late re-render made the step 5 rollback e2e fail every time when run alone, on `main` too (see learnings).
**Files:** `supabase/migrations/20261118025658_create_stats_functions.sql`, `src/types/database.types.ts`, `src/app/(app)/stats/{page.tsx,weekly-chart.tsx,include-archived-toggle.tsx,chart-color.ts}`, `src/app/(app)/layout.tsx`, `src/components/ui/chart.tsx`, `src/lib/{stats,stats-query,dates,status,revalidate,application-queries}.ts`, unit tests beside them, `tests/rls/stats-query.test.ts`, `tests/e2e/stats.spec.ts`, `tests/e2e/support/{local-env,fixtures}.ts`, `package.json`, `package-lock.json`, `.claude/rules/{database,server-actions,ui,testing}.md`, `docs/learnings.md`
**Tests**
- Unit, dates: `startOfWeek` (Sunday, Monday, year and leap boundaries) and `formatMonthDay`.
- Unit, window: `statsWindow` covers 12 weeks, half-open, with Sunday and Monday edges and a year boundary. The same instant falls in different weeks in Pago Pago and Kiritimati.
- Unit, aggregation: week binning (edge days in, outside days ignored), status counts, stage durations.
- Unit, formatting: response-rate rounding, 199 of 200 shows 99% (never 100% unless all responded), the no-data case; `formatDays`, including "<0.1 days".
- Unit, status: `forwardPathFrom`, `RESPONSE_RATE_FROM` and the response-rate sets.
- Local stack (`tests/rls/stats-query.test.ts`, 7 tests running the real `selectStats` with three fake users). Each event is backdated as it's logged (the newest event after each insert or update):
  - exact stage averages, with archived excluded and included, and the window edges;
  - a re-entered stage: Applied → Screening → Applied → Screening → Rejected gives Applied 2 stays averaging 2.5 days and Screening 2 averaging 1 day, and the application counts once in the response rate (1 of 1);
  - another user calling all four RPCs directly with the widest arguments (every status, `-infinity` to `infinity`, archived included) gets empty or zero results;
  - another user sees all zeros, and their own rows never reach the owner's stats;
  - the 32-status cap: 33 in either list fails with 22023, and 32 works;
  - anon gets 42501 from all four functions.
- E2E `tests/e2e/stats.spec.ts`, at 375px with seeded fake data and backdated events:
  - the counts, the 50% response rate, the weekly total and table, and "Applied 4 days 2" show;
  - the archived toggle changes the numbers, survives a reload and turns back off;
  - no horizontal scroll, and no console errors or warnings;
  - a second user sees the empty state with the toggle off and on.
**Checks** (final code, with nothing else using the local stack)
- `npx supabase db reset`: clean. `npm run db:types`: no change from the first version, since the function signatures are unchanged.
- Local advisors: only the expected `unused_index` INFO. `db lint --schema public,private`: no errors.
- typecheck, lint, `npm test` (192) and the build with the CI placeholder env all pass.
- `npm run test:rls`, 3 serial runs: 43/43 each time.
- `npm run test:e2e`, 3 serial runs: 20/20 each time, after the `signInAs` fix. Before that fix, the first run failed the step 5 rollback test, which also failed every single run on `main`. On the final code, `stats.spec.ts` passed 6 serial repeats of each test (12 runs). After the fix, the rollback test passed 3 single runs and 5 repeats.
- Screenshots checked at 375px and 1280px, light and dark (`.dark` on `<html>`), on the first version.
**Reviews:** security reviewer SAFE (live probes with attacker arguments; anon refused with 401/42501; no leaks). Verification met every F9 criterion. Five code-quality passes; their findings are applied in the second commit.
**Decisions / defaults** (PRD silent)
- Weeks start on Monday (ISO). "Last 12 weeks" is the current week plus the 11 before it, by `date_applied` in any status; a future `date_applied` in the current week counts.
- Response rate goes by status history along the forward path. "Reached Applied" means the application was ever Applied or at a later forward stage (Screening, Interviewing, Offer, Accepted); "responded" means Screening or later. Rejected, Withdrawn and Ghosted aren't on the path, so an Applied → Rejected application counts as reached but not responded (the PRD read literally; flagged for the owner). History is permanent (D5), so a mis-drag to Screening still counts as responded. Shown as a whole percent, capped at 99% until every application has responded.
- Average days per stage counts completed stays only (entering a status until the next change), as elapsed time (seconds / 86400), rounded to 0.1 day. An average above 0 that rounds to 0 shows "<0.1 days". A re-entered stage counts as another stay. The current stage isn't included, and the page says so.
- Status counts use each application's current status. All stats exclude archived applications unless the toggle is on (F9).
- One query per stat, all from SQL functions (no views): each needs parameters (the window, the toggle, the status lists).
**Follow-ups**
- Step 9: push this migration to prod with the other eight (owner approval). After the push, check `proacl` on prod for the four `stats_*` functions: execute for authenticated only, none for anon or service_role.
- Design pass: the response-rate tile leaves empty space at desktop width. (Fixed in the 2026-11-18 design pass.)
- Not a concern now: PostgREST's 1000-row cap. The per-day query returns at most 84 rows, and the others return one row per status.

## 2026-11-18: Launch step 9: deploy prep, waiting for owner
**Status:** Partial. Runbook and config ready (branch `chore/deploy-prep`); nothing has touched prod. No `supabase link`, `db push`, MCP, Vercel CLI or dashboard change was made.
**What was done**
- `docs/deploy.md`: the ordered runbook. (A) owner dashboard steps: wake the project, reset the DB password, Auth settings (sign-ups off, OTP 6 / 900 s, Magic Link template text, rate limits, SMTP decision), Data API schemas, add the owner user, Vercel import (Node 22, `npm ci`, the two `NEXT_PUBLIC_*` vars for Production only, production branch `main`, previews off via Ignored Build Step, no analytics), Site URL and redirect URLs. (B) the CLI steps Claude runs only after each approval, with all 9 migrations listed in apply order. (C) a phone and desktop smoke test. (D) rollback. (E) the paused-project note.
- `package.json`: `engines.node` = `22.x` (matches CI; `@supabase/supabase-js` needs Node 22+, and Vercel honors it over its dashboard default). Mirrored into the root entry of `package-lock.json` by hand (a lockfile-only `npm install` also rewrote unrelated bundled entries, so that was reverted).
- `prepare` now runs `scripts/install-hooks.mjs`, which sets `core.hooksPath` only inside a git checkout. The old inline `git config` would fail `npm ci` on a build machine with no `.git` folder.
- Supabase CLI 3.1 targets the **local** database unless a command gets `--remote` (checked with `--help`; hosted changes also need `--yes`). The `db-migration` skill said `db push --yes`, which would now push to local; fixed to `db push --remote --skip-vault --yes` and the advisors step to `db advisors --remote`. `.claude/rules/database.md` notes the `--remote` default and never to run `supabase config push`.
**Files:** `docs/deploy.md`, `docs/progress.md`, `docs/learnings.md`, `package.json`, `package-lock.json`, `scripts/install-hooks.mjs`, `.claude/skills/db-migration/SKILL.md`, `.claude/rules/database.md`
**Checks:** typecheck, lint, `npm test`, build with the CI placeholder env (no local stack used; results in the PR).
**Deploy-readiness review (no prod access):** `next.config.ts` (`cacheComponents`, `partialPrefetching`, Turbopack CSS rule) needs nothing Vercel-specific; `logging.serverFunctions: false` only affects dev output. No web fonts to fetch (system stacks). `react-is` 19.3.0 pin and the Linux binaries are in the lockfile. The app reads only the two public env vars; no hard-coded localhost or `emailRedirectTo`.
**Approval gates (each needs the owner's explicit OK, in order)**
1. `npx supabase link --project-ref skcsrdyqsqkinrrwtdyh` (after the owner runs `npx supabase login`).
2. Read-only pre-push checks and `db push --remote --skip-vault --dry-run`.
3. `db push --remote --skip-vault --yes` (the 9 migrations).
4. Read-only prod checks: advisors, lint, RLS/grant/`proacl` queries, type drift.
**Owner to-dos (dashboards; see docs/deploy.md part A)**
- Merge this PR; restore the project if paused; reset the DB password.
- Auth: sign-ups off; OTP length 6 and expiry 900 s; Magic Link template (subject + body in deploy.md A3); Gmail SMTP with an App Password (A3a, decided 2026-11-18); then the email rate limit to 30 an hour.
- Data API exposes only `public` and `graphql_public`.
- After the push: add your user, auto-confirmed.
- Vercel: import, env vars (Production only), deploy, production branch `main`, previews off, analytics off; optionally match the function region to Supabase's.
- Site URL = the prod URL; redirect URLs `<prod-url>/**`; no localhost entries.
- Run the smoke test (deploy.md part C).
**Open owner decisions** (all but the keep-alive decided on 2026-11-18; see the "Owner decisions" entry)
- ~~Closed-status follow-ups on the home page~~: keep.
- ~~Does a rejection count as a response~~: yes.
- ~~Dark mode toggle~~: no, follow the OS.
- ~~Custom SMTP~~: yes, Gmail SMTP (free).
- ~~Read-only Supabase MCP~~: yes.
- ~~Firefox/WebKit in Playwright~~: yes, added.
- Keep-alive for the paused-project issue (use weekly, upgrade, or a scheduled ping), default: none.
**Follow-ups (unchanged, not blocking launch)**
- Reject Intl-unsupported time-zone names (such as `Factory`) in the database in the next migration; the app already falls back to UTC.
- Atomic interview + links RPC; shared form pieces. (The response-rate tile layout is fixed by the design pass, PR #9.)
- After the push, record advisor results, `proacl` for the four `stats_*` functions and type drift here.

## 2026-11-18: Design pass (whole app)
**Status:** Done, pending owner review (branch `feat/design-pass`). No migration, no behaviour or copy changes; nothing touched prod.
**What was done**
- New visual system, documented in `DESIGN.md`: restrained, high-contrast, engineering-precise. Neutral greys with a faint cool cast, near-black ink, 4px radius, hairline borders and no decorative shadows, one sans family with a fixed scale (`text-title`, `text-heading`, `text-figure`), and colour only for meaning (overdue red, due-today amber, destructive red).
- Dark mode now applies. Before, the `dark:` variant and the dark tokens hung off a `.dark` class that nothing set, so the app was always light. `dark:` is now a `prefers-color-scheme` media variant, and the dark tokens are a designed palette (surfaces lighten as they rise), not an inversion. Native controls follow through `color-scheme`.
- Font: Archivo, SIL Open Font License 1.1 (Omnibus-Type), self-hosted with `next/font/local` from `src/app/fonts/archivo-latin-wght-normal.woff2` (Latin subset, variable 100–900, 35 KB, taken from the `@fontsource-variable/archivo` 5.3.0 package; licence in `src/app/fonts/Archivo-OFL.txt`, no Reserved Font Name). No network at build or run time.
- Signature element: `StageRule` (`src/components/stage-rule.tsx`), a segmented bar along the active stages, filled up to the current one. It heads each board column and sits beside the status on the application page. It's decorative (`aria-hidden`), since the status is always written beside it. Accepted fills every segment; Rejected, Withdrawn and Ghosted fill none. Its segments fill one after another (40ms stagger) when the status changes.
- Shell: the header is a card-coloured bar with a bottom border, holding the wordmark, the nav and sign-out. The nav now marks the current section with `aria-current="page"` and a 2px underline. It's a client component (`(app)/main-nav.tsx`) inside Suspense.
- Pages, restyled within their existing structure:
  - Reminders: each bucket is one bordered panel with ruled rows. Mark done sits on the right from `sm`. The Overdue count turns red when it isn't zero.
  - Applications: a segmented Board/Table switch. Board columns get the stage rule and tabular counts. Cards are quieter, with an edge that darkens on hover. The dragged card tilts 1° and settles in 250ms. The table sits in a bordered panel.
  - Application page: a back link with a chevron and the stage rule beside the status badge. Details are a ruled two-column list, and notes and history are ruled panels. Inline edit forms no longer nest a second box inside the row.
  - New and Edit: one panel with a footer bar for Cancel and Save. Field grids are top-aligned.
  - Stats: the response rate is a full-width band, which fixes the dead space noted in step 8. The two tables pair up below it, and the weekly chart is full width. Marks use `--chart-2`, at least 9.7:1 against the card in both themes.
  - Settings, login and the error page: panels on the new tokens.
- shadcn primitives are untouched. Theming goes through tokens and unlayered `[data-slot]` rules in `globals.css`: badge radius, muted table headers, popover-coloured dialogs, overlay motion, and the toast font and easing. `shadow-xs` and `shadow-sm` are flat. Unused shadcn tokens (`--chart-1/3/4/5`, `--sidebar-*`) are gone.
- Shared pieces in `src/components/section-ui.tsx`: `PanelSection` (titled bordered panel: application status, settings, stats sections), `Empty` (`row` and `page` empty states) and `ADD_FORM_PANEL` (the panel around the add contact and add interview forms; the same forms inside a list row have no chrome). `.table-panel` in `globals.css` pads a panelled table's edge columns.
- Motion uses the transitions-dev tokens (`--duration-quick` 150ms, `--duration-fast` 250ms, `--ease-smooth-out`, `--scale-large/medium/tiny`). Dialogs and menus open in 250ms and close in 150ms, and menus grow from their trigger with no slide. Tailwind's default transition is 150ms on the same curve. Reduced motion keeps the fades and drops scale, tilt, stagger and the drop animation.
- Focus: one global 2px outline in `--ring`, offset 2px. It replaces shadcn's half-opacity ring, which vanished against the black primary button.
- `.gitattributes` marks `*.woff2` binary. ESLint now ignores `.claude/skills/**`: the skills vendored in this branch's first commit added 93 lint warnings from their bundled scripts.
**Files:** `DESIGN.md`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/fonts/{archivo-latin-wght-normal.woff2,Archivo-OFL.txt}`, `src/components/{stage-rule,follow-up-badge}.tsx`, `src/app/(app)/{layout,main-nav,page,error}.tsx`, `src/app/(app)/applications/{page,pipeline-board,pipeline-table,application-form}.tsx`, `src/app/(app)/applications/new/page.tsx`, `src/app/(app)/applications/[id]/{page,sections,contacts,interviews}.tsx`, `src/app/(app)/applications/[id]/edit/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/stats/{page,weekly-chart,chart-color}.tsx`, `src/app/(auth)/login/page.tsx`, `eslint.config.mjs`, `.gitattributes`, `.claude/rules/ui.md`, `docs/learnings.md`
**Checks:** typecheck, lint (0 problems), `npm test` (192), build with the CI placeholder env and `npm run test:rls` (43/43) pass. `npm run test:e2e`: 20/20 on 5 of 6 full runs, with no selector changes needed; the sixth, right after a build, had 1 failure whose output was not kept; later runs all passed, as did 60 serial repeats of every spec. After the review fixes, every gate was run again serially: see the review-fixes note below. Screenshots of every page in light and dark at 375px and 1280px came from a production build with fake data and aren't committed. Every page had a clean console and no horizontal scroll, and the dialog's computed animation is `enter 0.25s cubic-bezier(0.22, 1, 0.36, 1)`. Contrast was computed from the OKLCH tokens; DESIGN.md lists the ratios.
**Decisions / defaults**
- Colour approach: restrained neutrals plus semantic state colours only, with no brand accent colour.
- Deliberately not copied from the reference design language: its typeface, icons, marque, name, colours and components. Only its qualities were borrowed (restraint, contrast, tight spacing, small radii, quiet motion), and every value here is original.
- The impeccable skill's launcher, concept roll and review agents weren't run: the brief pinned the direction and ruled out the launcher. Its critique and audit checklists were applied by hand to the screenshots.
- The font is the Latin subset only, so other scripts fall back to the system sans. If names with Central European characters look off, add the latin-ext file with a `unicode-range` declaration.
**Follow-ups**
- The application page shows a "Status" heading above a "Status" select label. That's existing copy, left as is.
- Owner to decide: keep dark mode OS-only, or add a toggle later (it would need the `.dark` class variant back).
**Review fixes (same day)**
- The stage rule fills every segment for Accepted. The nav underline has no transition under reduced motion. Dead `focus-visible:ring` classes are gone.
- Shared `PanelSection`, `Empty` and `ADD_FORM_PANEL`. Contact and interview forms have no chrome of their own. The application form's footer is a sibling with its own padding. The nav takes its link height from the link class, and its width no longer depends on the header's padding. A `.table-panel` rule replaces four arbitrary selectors.
- Tokens: the default transition reads `--duration-quick` and `--ease-smooth-out`. Unused motion tokens, `--chart-1/3/4/5` and `--sidebar-*` are deleted, and `shadow-sm` is flat (the Board/Table segment no longer has a shadow). The wordmark is `text-base`, chart bars share `MARK_RADIUS`, and narration comments are trimmed. `globals.css` is regrouped (focus, badge, table, dialogs, menus, toasts, one reduced-motion block). DESIGN.md is brought in line with the code.
- Gates on the final code, run one after another: typecheck, lint, `npm test` (192), the CI build and `npm run test:rls` (43/43) pass. `npm run test:e2e`: two runs on the final code failed, the first with 3 failures and the second with 1. Every failure was a timeout in a long phone-width test or in the sign-in fixture's time-zone wait, and those runs were slower (50s against 38s). The next four full runs passed 20/20: two normal runs, one right after a fresh build and one with a single worker. The failing applications test also passed 3 serial repeats on its own (7 to 11s each against its 30s limit). Not reproduced; logged as a load flake. Screenshots were recaptured on the final code.

## 2026-11-18: Owner decisions applied (branch `chore/owner-decisions`, PR #11)
**Status:** Done, pending owner review. No migration. Nothing touched prod (no link, `--remote`, push, MCP or Vercel command). PR #11 has the full change list and gate numbers.
**Decisions (owner, 2026-11-18)**
1. A rejection counts as a response. Of the applications that reached Applied or later, "responded" means reached Screening or later, or went to Rejected. Withdrawn and Ghosted don't count, and an application that went from Saved straight to Rejected isn't counted. This is `RESPONSE_RATE_CLOSED_RESPONSES` in `status.ts`; the SQL function already takes the lists. Known edge: the function checks each list without order, so an application rejected first and moved to Applied later would also count as responded. Rare; left as is.
2. Follow-ups on closed applications stay on the home page ("yes, but very rare"). No change.
3. Dark mode follows the OS, no toggle. No change.
4. The detail page's status select is labelled "New status", under the "Status" heading.
5. Custom SMTP "yes if free": Gmail SMTP with an App Password, then the email rate limit at 30 an hour (deploy.md A3a and A3.5). The owner does these in the dashboard and re-tests sign-in in the smoke test.
6. Read-only Supabase MCP, with features trimmed to `docs`, `database`, `debugging` and `development`. Reasoning in [deploy.md part B](deploy.md#supabase-mcp). Read-only still allows `SELECT` on prod rows, so Claude queries prod only for the deploy's read-only checks. **The owner must restart Claude Code (or `/mcp`) for it to apply.**
7. Firefox and WebKit join Chromium in Playwright, each project with its own test users (the `users` fixture). E2E runs against a fresh production build; `E2E_REUSE_SERVER=1` reuses a running server. CI still runs no e2e.
**Cross-browser bug fixed in the app:** Firefox fetched the font twice (a `Link` preload header and a `<link>` tag) and warned; `preload: false` in `layout.tsx`. The rest was test timing or engine noise (learnings.md, 2026-11-18): fills during hydration, cancelled-fetch errors when a test leaves a page, and dnd-kit's lag after the last move.
**Review fixes (code-quality review of PR #11):** the `users` fixture replaces the `TEST_USERS` getters; global setup lists users once; the server is reused only with `E2E_REUSE_SERVER`; failed tests keep traces; the 60s timeout applies to Firefox and WebKit only; the applications and pipeline specs check the console too, which needed the collector to drop errors from cut-off fetches; the stats copy reads "…heard back: they reached Screening or later, or were rejected."; the `.mcp.json` features are trimmed; comments and docs are tightened.
**Checks after the review fixes** (run one after another, nothing else on the stack): typecheck, lint, `npm test` (192), the CI-env build and `npm run test:rls` (44/44) pass. `npm run test:e2e`: the first two runs, before the collector change, failed on console noise only (59/60 with 1 WebKit failure, then 55/60 with 1 Firefox and 4 WebKit failures). The two runs after it were each 60/60 (chromium 20, firefox 20, webkit 20).
**Files:** `src/lib/status{,.test}.ts`, `src/app/(app)/stats/page.tsx`, `src/app/(app)/applications/[id]/application-controls.tsx`, `src/app/layout.tsx`, `playwright.config.ts`, `tests/e2e/**`, `tests/rls/stats-query.test.ts`, `.mcp.json`, `docs/{deploy,progress,learnings}.md`, `docs/prd/PRD.md`, `.claude/CLAUDE.md`, `.claude/rules/{testing,ui}.md`
**Backlog**
- A controlled field typed into before hydration finishes can be wiped on a slow device (React resets it at the commit). It's a UX gap; not changed.
- Keep-alive for the paused-project issue (default: none).

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
**Status:** Done, pending owner review (branch `feat/applications-crud`). No migration; nothing touched prod.
**What was done**
- Routes: `/` lists applications (company, role, status, Archived badge; archived hidden unless `?archived=1` via "Show archived"; step 5 replaces it), `/applications/new`, `/applications/[id]` (detail), `/applications/[id]/edit`. Data reads sit inside `<Suspense>` (Cache Components) and go through `src/lib/application-queries.ts` (server-only; uuid check, `user_id` filter on top of RLS, `notFound()` for bad/missing/foreign ids).
- Server Actions in `src/app/(app)/applications/actions.ts`: `createApplication` (status `applied` when a date applied is set, else `saved`; redirects to the detail page), `updateApplication` (content columns only), `changeStatus`, `setArchived`, `deleteApplication` (redirects home; children and history cascade). Each re-checks the user, parses with the shared Zod schema, filters by `user_id`, treats "no row returned" as not found, maps DB errors with `writeErrorMessage()` and revalidates `/` and the detail path. No `status_events` writes; only granted content columns are written.
- `src/lib/schemas/application.ts` mirrors the DB checks: non-blank company/role, `TEXT_LIMITS`, http(s) `job_url` (also `URL.canParse`), whole non-negative salaries up to int4 max (commas allowed), min <= max, `^[A-Z]{3}$` currency (upper-cased), `WORK_MODES`, real `YYYY-MM-DD` dates; blanks become null. `statusChangeSchema` uses `z.enum(STATUSES)`.
- Detail page: status badge, all fields (salary via `formatSalaryRange`, dates via `src/lib/dates.ts`, job link with `rel="noopener noreferrer"`), description, status control (select + "Change status", plus "Move to <next>" from `nextSuggestedStatus`), Archive/Unarchive, Delete behind an AlertDialog, and the status history (newest first, times in `profiles.time_zone` via `getTimeZone()`, UTC fallback).
- Helpers: `src/lib/applications.ts` (`initialStatus`, `toFormValues`, `EMPTY_APPLICATION_FORM`, `formatSalaryRange`, paths), `src/lib/dates.ts` (`formatDate`, `formatDateTime`, `FALLBACK_TIME_ZONE`), `src/lib/db-errors.ts`, `src/lib/profile.ts`, `isStatus`/`statusLabel` in `status.ts`, `WORK_MODE_LABELS` in `closed-sets.ts`, `src/components/status-badge.tsx`.
- shadcn: textarea, native-select, alert-dialog, badge, sonner (adds `sonner` and `next-themes`; checked repos/maintainers). `<Toaster />` in the root layout.
- Tests: unit tests for the schema (every mirrored check), helpers, dates, status guards. E2E `tests/e2e/applications.spec.ts` with the new reusable `signInAs` fixture (`tests/e2e/support/fixtures.ts`: admin `generateLink` + `/auth/confirm`, wipes that user's applications first): at 375px create (validation errors first), edit, Move to Applied (history + date applied = today), any-status change, archive/hidden/show archived/unarchive, delete with cancel then confirm, 404 after delete; plus "a date applied on create starts in Applied" and a blank next "New application" form. `auth.spec.ts` now expects the "Applications" heading.
- Rules: ui.md, testing.md, server-actions.md lessons; learnings for hidden Activity routes in e2e and zodResolver raw mode.
**Files:** `src/app/(app)/page.tsx`, `src/app/(app)/applications/{actions.ts,application-form.tsx}`, `src/app/(app)/applications/new/page.tsx`, `src/app/(app)/applications/[id]/{page.tsx,application-controls.tsx}`, `src/app/(app)/applications/[id]/edit/page.tsx`, `src/app/layout.tsx`, `src/components/status-badge.tsx`, `src/components/ui/{alert-dialog,badge,native-select,sonner,textarea}.tsx`, `src/lib/{applications,application-queries,dates,db-errors,profile}.ts`, `src/lib/{applications,dates}.test.ts`, `src/lib/schemas/application{,.test}.ts`, `src/lib/{status,status.test,closed-sets}.ts`, `tests/e2e/{applications.spec,auth.spec}.ts`, `tests/e2e/support/{fixtures,local-env}.ts`, `package.json`, `package-lock.json`, `.claude/rules/{ui,testing,server-actions}.md`, `docs/learnings.md`
**Checks:** typecheck, lint, `npm test` (75/75), `npm run build` with the CI placeholder env, `npm run test:e2e` (6/6), `npm run test:rls` (29/29) all pass locally.
**Decisions / defaults**
- Default currency USD (PRD default), editable per application; follow-ups are date-only (PRD default).
- Status is not on the create/edit form: F2 sets the initial status, F4 changes it on the detail page. Editing date applied later doesn't change status.
- The status select applies on an explicit "Change status" button (keyboard arrowing through a native select fires `change` per option). "Move to <next>" follows `nextSuggestedStatus`; `accepted` and the other closed statuses show no suggestion.
- Archive needs no confirmation; delete does (ui.md). Archived applications are still reachable by URL and from "Show archived".
- Salary input accepts commas ("120,000") and stores an integer.
- Action errors show as toasts (ui.md); field errors inline.
**Follow-ups**
- Step 5 replaces the home list with the table and board views (reuse `listApplications`, `StatusBadge`, `changeStatus`).
- Step 7: detect `profiles.time_zone`; until then dates on the detail page use UTC.
- Run the verification and security-reviewer agents (personal-data change) before merge.

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
**Status:** Done, pending owner review (branch `feat/auth`)
**What was done**
- `@supabase/ssr` clients: `src/lib/supabase/server.ts` (cookies(), server-only), `client.ts` (browser), `proxy.ts` (`updateSession`, request/response cookies + no-cache headers on redirects).
- `src/proxy.ts`: refreshes the session via `getClaims()` on every non-static request; signed out → `/login?next=<path>`; signed in on `/login` → `/`. Public routes: `/login`, `/auth/confirm` (`src/lib/auth-routes.ts`).
- `/login` (`src/app/(auth)/login`): email step → `signInWithOtp({ shouldCreateUser: false })`; code step → `verifyOtp({ type: 'email' })`, then redirect to `safeNextPath(next)`. Both are Server Actions with shared Zod schemas (`src/lib/schemas/auth.ts`) and react-hook-form + shadcn form. Unknown emails and 4xx errors get the same "if this email has an account" answer.
- `/auth/confirm` route: `verifyOtp({ token_hash, type: 'email' })` → same-origin redirect; failures → `/login?error=link`.
- `(app)/` layout with header (email + Sign out, `signOut({ scope: 'local' })`) and a minimal home page; the old root page moved there. `getCurrentUser()` in `src/lib/auth.ts` (getClaims, `connection()`, React `cache`).
- Local Supabase: Magic Link template with link + `{{ .Token }}` (`supabase/templates/magic_link.html`), `site_url` now `http://localhost:3000`, redirect allow-list for localhost/127.0.0.1, local `email_sent` rate limit 2 → 100 (e2e).
- `next.config.ts`: `logging.serverFunctions: false` (dev logged emails and codes).
- Deps: zod, react-hook-form, @hookform/resolvers (via shadcn `form`), server-only; shadcn input, label, card, form.
- Tests: unit for `auth-routes` (public paths, open-redirect cases) and auth schemas. Playwright: signed-out redirect (with `next`), code sign-in at 375px (wrong code, off-site `next` ignored, `/login` bounces home, no horizontal scroll, sign-out), magic-link sign-in (and link is single-use), unknown email (generic answer, no mail, no user). Global setup creates fake users via the local admin API; a guard refuses non-local Supabase URLs. `smoke.spec.ts` removed (covered by the auth spec).
- Rules updated: auth.md (proxy helper, DAL, lessons), testing.md (e2e setup lessons), ui.md (inline error exception for sign-in), CLAUDE.md rules table.
**Files:** `src/proxy.ts`, `src/lib/supabase/{server,client,proxy}.ts`, `src/lib/{auth,auth-routes,auth-routes.test}.ts`, `src/lib/schemas/{auth,auth.test}.ts`, `src/app/(auth)/login/{page,login-form,actions}.ts(x)`, `src/app/auth/confirm/route.ts`, `src/app/(app)/{layout,page,actions}.ts(x)`, `src/components/ui/{card,form,input,label}.tsx`, `supabase/config.toml`, `supabase/templates/magic_link.html`, `tests/e2e/{auth.spec,global-setup}.ts`, `tests/e2e/support/local-env.ts`, `playwright.config.ts`, `next.config.ts`, `package.json`, `package-lock.json`, `.claude/rules/{auth,testing,ui}.md`, `.claude/CLAUDE.md`, `docs/learnings.md`
**Checks:** typecheck pass; lint pass; `npm test` 39/39; `npm run build` with the CI placeholder env and no `.env.local` pass (`/` partial prerender, `/login` static, `/auth/confirm` dynamic); `npm run test:e2e` 4/4 against the local stack. Verification and security-reviewer agents not run by this session (handed back to the lead).
**Decisions / defaults**
- Sign-in steps run as Server Actions (server client), not in the browser, so validation and the "don't reveal accounts" mapping live on the server.
- Sign-out is local scope ("ends the session on the device", F1).
- The magic link always lands on `/`; only the code path honours `?next=` (the email template has no per-request redirect). Fine for one user; revisit if deep links matter.
- A 429 (rate limit) also shows the generic "check your email" answer, so it can't reveal an account; the owner may wait for an email that isn't coming. Only 5xx/network errors show "couldn't send".
- Login errors are shown inline (`role="alert"`), not in a toast (no toast library yet).
**Follow-ups (owner, prod; do at step 9 or before first prod sign-in)**
- Supabase dashboard → Auth → Sign In / Providers: turn **Allow new users to sign up** off.
- Add the owner's user (Auth → Users → Add user, auto-confirm).
- Auth → Email Templates → Magic Link: link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` plus `{{ .Token }}` (copy `supabase/templates/magic_link.html`); OTP length 6.
- Auth → URL Configuration: Site URL = the Vercel production URL; redirect URLs = `<prod URL>/**`.
- Consider custom SMTP: the built-in sender is heavily rate-limited.
- Still open from step 1: DB password reset, read-only MCP decision.

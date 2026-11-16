---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "tests/**"
  - "playwright.config.ts"
  - "vitest.config.mts"
  - "vitest.rls.config.mts"
---

# Testing: unit, RLS, e2e

## Conventions
- **Unit (Vitest):** pure logic in `src/lib/` (status helpers, date/"today" math across time zones and DST, stats helpers, Zod schemas). Tests sit next to the source as `*.test.ts`.
- **RLS checks:** SQL or Node scripts under `tests/rls/` run against the **local** Supabase stack with two test users, proving user A can't read or write user B's rows in every table, and that nobody can insert, update or delete `status_events` directly.
- **E2E (Playwright):** 2–3 key flows only: sign in → add application → move it on the board → see it in history and stats; follow-up shows in Today. Tests sign in a dedicated test user via the local stack's admin API (D4), using the local secret key from `npx supabase status` in a git-ignored env file. That key is never used by app code.
- Fixtures use obviously fake data (`Acme Corp`, `jane@example.com`, `555-0100`).

## Must / must not
- Never run e2e or RLS tests against the prod project.
- No real people's names, emails, phone numbers or real salary data in tests or screenshots.
- CI runs unit tests only (no secrets in CI); RLS and e2e run locally against the Docker stack.
- A bug fix starts with a failing test (see `validate-fix`).

## RLS suite
- `npm run test:rls` runs `tests/rls/**/*.test.ts` with `vitest.rls.config.mts` (loads `.env.local`, files run serially). The main `vitest.config.mts` only includes `src/**`, so CI never needs a database.
- It recreates fake users `rls-a@example.com` / `rls-b@example.com` each run and signs them in with admin `generateLink` + `verifyOtp({ type: "email", token_hash })` (no email involved). It reuses the localhost guard and admin client from `tests/e2e/support/local-env.ts`.
- Every new table or policy gets attacker-side checks there: B can't read/update/delete A's rows, can't insert under A's parent, can't spoof `user_id`, can't re-parent rows. Probe updates with a content column (one the client is granted), or the column privilege error hides what RLS would do.
- Expected codes: `42501` for RLS denials and missing column privileges (writing `user_id`, `id`, `application_id` on update, any write to `status_events`); `23503` for a child pointed at another user's or another application's parent (composite FKs); `23514` for check violations. Unique keys on user-owned rows lead with `user_id`, so another user's rows can never trigger `23505` (unique checks run before FK checks, which would otherwise leak whether a row exists); test forged rows with existing values too, including `upsert` with `ignoreDuplicates`. An RLS-filtered update or delete returns `data: []`, not an error.
- `npx supabase db reset` wipes auth users too; Playwright's global setup recreates its own.

## Lessons learned
- E2E setup lives in `tests/e2e/global-setup.ts` (creates confirmed fake users with the admin API) and `tests/e2e/support/local-env.ts` (admin client, Mailpit helpers, a guard that throws unless the Supabase URL is localhost). `playwright.config.ts` loads `.env.local` with `process.loadEnvFile`.
- Give each spec its own test user/inbox: tests run in parallel and Mailpit searches by recipient.
- `getByRole("alert")` also matches Next's empty `#__next-route-announcer__`; filter by text (`.filter({ hasText })`).
- Signed-in specs use the `signInAs(email, page?)` fixture from `tests/e2e/support/fixtures.ts` (import `test`/`expect` from there): it deletes the user's applications, makes a magic-link token hash with the admin API and opens `/auth/confirm` with it. No email involved. Pass a page from `browser.newContext()` to sign in a second user. Add a user per test to `TEST_USERS`.
- Hidden, still-mounted routes (docs/learnings.md) mean `getByLabel` and CSS locators can match a field twice. Use role locators (they skip hidden elements) or `.filter({ visible: true })`.
- `signInAs` ends on `/applications`, because `/` redirects there until step 7.
- Seed fake rows with `seedApplications(email, rows)` from `local-env.ts` after signing in, since sign-in clears the user's applications. It inserts with `defaultToNull: false`, so rows can leave columns out.
- To check for flakes, repeat serially: `--repeat-each=N --workers=1`. Parallel repeats run copies of a test as the same user, and each copy's `signInAs` deletes the others' rows.
- Board drag and drop works in Playwright: `page.mouse` down, `move(..., { steps })`, up. Start on the card's padding, not its link or menu.
- Radix menus can drop the first arrow key after a keyboard open. Press until the target item is focused (`expect(...).toPass()`), not a fixed number of times.
- To test an optimistic update, hold the Server Action request with `page.route` (match a POST with a `next-action` header), check the UI, then let it continue. `route.abort()` simulates a network failure.
- The local-stack suite shares sign-in helpers through `tests/rls/support.ts`. Give each file its own fake user, so files and parallel runs don't touch each other's rows.
- Setup that no client role may do (such as backdating `status_events`) goes through `localSuperuserQuery(sql)` in `tests/rls/support.ts`. It runs the Supabase CLI's `db query`, which targets the local stack because the repo is never linked.
- The magic link is built from `site_url` in `supabase/config.toml`, so it must match Playwright's `baseURL` (`http://localhost:3000`); cookies are per host.
- `getByLabel` also matches `aria-label` on buttons ("Edit note" matched both a textarea and an Edit button). Use `getByRole("textbox", { name })` when a field's label repeats in a button's name.
- `tests/e2e/detail.spec.ts` collects console errors and warnings plus page errors and expects none at the end; copy `collectConsoleErrors` for new UI specs.

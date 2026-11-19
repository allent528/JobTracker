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
- **E2E (Playwright):** runs in three projects, `chromium`, `firefox` and `webkit` (desktop devices from Playwright), side by side. 2–3 key flows only: sign in → add application → move it on the board → see it in history and stats; follow-up shows in Today. Tests sign in a dedicated test user via the local stack's admin API (D4), using the local secret key from `npx supabase status` in a git-ignored env file. That key is never used by app code.
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
- Give each test its own test user/inbox: tests run in parallel and Mailpit searches by recipient. Users are per project too: `testUserEmail(key, project)` in `local-env.ts` makes `e2e-<project>-<slug>@example.com`, global setup creates the set for every project in the config, and specs read `TEST_USERS.<key>` from `fixtures.ts` (a getter on `test.info().project.name`, so only inside a test). The address with no account is `noAccount()`. This lets the three browsers run at once without one project's `signInAs` deleting another's rows.
- `playwright.config.ts` starts `npm run build && npm run start` (a production build), or reuses whatever already listens on port 3000 (`npm run dev` for a quick loop; stop it before a gate run so the build is fresh). The dev server was too slow for three browsers at once. Test timeout is 60s for the long phone-width flows in Firefox and WebKit.
- `getByRole("alert")` also matches Next's empty `#__next-route-announcer__`; filter by text (`.filter({ hasText })`).
- Signed-in specs use the `signInAs(email, page?)` fixture from `tests/e2e/support/fixtures.ts` (import `test`/`expect` from there): it deletes the user's applications, makes a magic-link token hash with the admin API and opens `/auth/confirm` with it. No email involved. Pass a page from `browser.newContext()` to sign in a second user. Add a user per test to `TEST_USER_SLUGS` in `local-env.ts`.
- Hidden, still-mounted routes (docs/learnings.md) mean `getByLabel` and CSS locators can match a field twice. Use role locators (they skip hidden elements) or `.filter({ visible: true })`. Streaming can also briefly leave a hidden copy after a plain `page.goto`, so `getByText` on page content gets `.filter({ visible: true })` too.
- Backdate `status_events` in e2e with `localSuperuserQuery` from `tests/rls/support.ts` (see `tests/e2e/stats.spec.ts`). Backdate the newest event right after each insert or status change (`where id = (select id … order by changed_at desc limit 1)`), not by `to_status`, so a re-entered stage gets each of its events dated.
- `signInAs` clears the user's applications and `profiles.time_zone`, then ends on `/` (the reminders home page). It waits until the browser's zone is saved and the network is idle, because detection re-renders every page and a late re-render breaks whatever the test is doing. The browser's zone is saved on that first load, so `playwright.config.ts` sets `timezoneId: "UTC"`; a spec that needs another zone opens `browser.newContext({ timezoneId })`.
- For time-zone e2e that must not depend on the time of day, compare Pacific/Kiritimati (UTC+14) with Pacific/Pago_Pago (UTC-11): their dates always differ.
- Seed fake rows with `seedApplications(email, rows)` from `local-env.ts` after signing in, since sign-in clears the user's applications. It inserts with `defaultToNull: false`, so rows can leave columns out.
- Seed interviews with `seedInterviews(email, rows)`; `seedApplications` returns `{ id, company }` for each row.
- To check for flakes, repeat serially: `--repeat-each=N --workers=1` (add `--project=<name>` to pick a browser). Parallel repeats run copies of a test as the same user, and each copy's `signInAs` deletes the others' rows.
- Board drag and drop works in Playwright: `page.mouse` down, `move(..., { steps })`, up. Start on the card's padding, not its link or menu. Measure the target column after the drag has started ("Picked up …"), and release only once the live region says "… is over <column>.": Firefox and WebKit can still be on the previous column right after the last move.
- Radix menus can drop the first arrow key after a keyboard open. Press until the target item is focused (`expect(...).toPass()`), not a fixed number of times.
- To test an optimistic update, hold the Server Action request with `page.route` (match a POST with a `next-action` header), check the UI, then let it continue. `route.abort()` simulates a network failure.
- The local-stack suite shares sign-in helpers through `tests/rls/support.ts`. Give each file its own fake user, so files and parallel runs don't touch each other's rows.
- Setup that no client role may do (such as backdating `status_events`) goes through `localSuperuserQuery(sql)` in `tests/rls/support.ts`. It runs the Supabase CLI's `db query`, which targets the local stack because the repo is never linked.
- The magic link is built from `site_url` in `supabase/config.toml`, so it must match Playwright's `baseURL` (`http://localhost:3000`); cookies are per host.
- `getByLabel` also matches `aria-label` on buttons ("Edit note" matched both a textarea and an Edit button). Use `getByRole("textbox", { name })` when a field's label repeats in a button's name.
- UI specs call `collectConsoleErrors(page)` from `fixtures.ts` and expect it to be empty at the end. It ignores one thing only: WebKit's "<url>?_rsc=… due to access control checks." for a route prefetch that a `page.goto` cancelled.
- After a `page.goto` onto a form or the board, call `expectHydrated(locator)` from `fixtures.ts` before typing, clicking or dragging. It waits for the node's React fiber and for the root to have no pending render work. A fill during hydration is wiped by React's commit (WebKit under load hydrates seconds late), and a fiber alone isn't enough. Client-side navigations (clicking links) don't need it.

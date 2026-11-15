---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "tests/**"
  - "playwright.config.ts"
  - "vitest.config.mts"
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

## Lessons learned
- E2E setup lives in `tests/e2e/global-setup.ts` (creates confirmed fake users with the admin API) and `tests/e2e/support/local-env.ts` (admin client, Mailpit helpers, a guard that throws unless the Supabase URL is localhost). `playwright.config.ts` loads `.env.local` with `process.loadEnvFile`.
- Give each spec its own test user/inbox: tests run in parallel and Mailpit searches by recipient.
- `getByRole("alert")` also matches Next's empty `#__next-route-announcer__`; filter by text (`.filter({ hasText })`).
- The magic link is built from `site_url` in `supabase/config.toml`, so it must match Playwright's `baseURL` (`http://localhost:3000`); cookies are per host.

@docs/prd/PRD.md
@docs/negative-constraints.md

# JobTracker: working notes for Claude

The PRD above is the source of truth for *what* to build, including the settled technical decisions (D1–D16). This file covers *how*.

## Stack
- **App:** Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui, a single app at the repo root (D3). Hosted on Vercel.
- **Backend:** Supabase (Postgres, Auth). Local Supabase stack in Docker (`npx supabase start`) for development; one hosted project JobTracker (`skcsrdyqsqkinrrwtdyh`) for production (D2). Vercel previews are off (D15).
- **Data access:** `@supabase/ssr` + `supabase-js` with generated types in `src/types/database.types.ts`. Server Components read; Server Actions write (D1). **No ORM** (D1b).
- **Forms:** Zod schemas shared by client forms and Server Actions; react-hook-form + shadcn form components (D14).
- **Board drag-and-drop:** `@dnd-kit/core`. **Charts:** Recharts via shadcn/ui charts.
- **Tests:** Vitest (unit), Playwright (e2e), SQL scripts for RLS checks (D4).
- **Package manager:** npm. Don't introduce another one (no pnpm, yarn or bun lockfiles).

## Repo layout
```
src/app/             Next.js routes (App Router); (auth)/login, (app)/ for signed-in pages
src/components/      shared UI; src/components/ui/ is shadcn-generated
src/lib/             domain logic and helpers: status.ts (status constant), supabase/ (server + browser clients), dates.ts
src/types/           database.types.ts (generated, never hand-edit)
supabase/            migrations/, seed.sql (fake data only), config.toml
tests/               e2e/ (Playwright); unit tests sit next to source as *.test.ts
docs/                prd/, progress.md, learnings.md, negative-constraints.md
scripts/             project scripts (precommit.mjs, checks)
```

## Commands
Run from the repo root.
- Install: `npm install` (also enables the pre-commit hook via the `prepare` script)
- Dev server: `npm run dev`
- Typecheck: `npm run typecheck` → `next typegen && tsc --noEmit`
- Lint: `npm run lint`
- Build: `npm run build` (CI runs it with placeholder env)
- Unit tests: `npm test` → `vitest run`
- E2E: `npm run test:e2e` → `playwright test`
- Local Supabase: `npx supabase start` / `npx supabase stop` (needs Docker Desktop running); `npx supabase db reset` reapplies all migrations + seed locally
- DB types: `npm run db:types` (generated from the local stack)
- New migration: `npx supabase migration new <snake_case_name>`; apply only via the `db-migration` skill.
- Pre-commit check: `node scripts/precommit.mjs`
- CI: `.github/workflows/ci.yml` runs install, typecheck, lint, tests and `next build` on every PR and push to main. No secrets needed.

## Environment constraints
- Development is on Windows 11. Use forward-slash paths in scripts, and keep package scripts cross-platform (no bash-only syntax; use Node scripts for anything nontrivial).
- Docker Desktop must be running for the local Supabase stack. Migrations are written and verified locally (`db reset`, RLS checks, advisors); `npx supabase db push` to prod is live and needs the owner's OK each time.
- Only one hosted project exists for JobTracker, and it is production. Never run tests, seeds or experiments against it.
- Free Supabase projects pause after about a week idle. If requests time out, check whether the project is paused before debugging code.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (git-ignored), pointing at the local stack (values from `npx supabase status`). Vercel production holds the prod values.

## Non-negotiable rules
- **RLS everywhere:** every table has RLS enabled with `user_id = (select auth.uid())` policies in the migration that creates it. No table is ever exposed without them.
- **Secrets:** the Supabase secret / service_role key never appears in app code, `NEXT_PUBLIC_*` vars, or the repo. v1 doesn't use it at all (the e2e admin helper reads it from a local env var only).
- **No RLS bypass:** never use an ORM or a direct Postgres connection from the app; all access goes through `supabase-js` with the user's session.
- **Status history is the trigger's job:** never insert, update or delete `status_events` from app code, and never add client write policies to it.
- **Statuses come from `src/lib/status.ts`:** never hard-code status strings elsewhere. Changing the set requires a migration updating the check constraint in the same PR.
- **Personal data stays private:** no analytics, tracking scripts or third-party embeds; no real names, emails, phones or salaries in seeds, tests, fixtures, screenshots or logs.
- **Schema changes** only go in new migration files. Never edit an applied migration. Prod gets a migration only after dev.
- When the PRD leaves something open, use the proposed default, note it in `docs/progress.md`, and keep going. Don't invent new product behavior.

## Workflow
- Work one PRD step or feature at a time. For anything multi-file, use the **planner** agent (or plan mode) first.
- After finishing a task, run the **verification** agent; for database, auth or any personal-data change also run the **security-reviewer** agent. Commit only when the user asks, using the **git-commit** agent (pass it the attribution lines to use).
- **Bug fixes and small before/after changes** follow the `validate-fix` skill. That is the owner's standing approval for the workflow to commit, push, open the PR and merge it when the skill's "small" rules all hold; anything else waits for the owner's review.
- Before merging any PR, run the `code-quality-review` skill.
- Commits run `.githooks/pre-commit` (blocks keys, .env and build files). Never bypass it with `--no-verify`.
- After completing a task, append an entry to `docs/progress.md`: what was done, files touched, status, blockers.
- When you hit a bug, wrong assumption, or non-obvious fix, append an entry to `docs/learnings.md`: mistake, root cause, fix, lesson.
- When the user says "never do X", add it to `docs/negative-constraints.md`.

## Rules (`.claude/rules/`)
Each rule loads **automatically when you read or edit a file matching its `paths`**. Rules are *not* loaded while you're only planning or answering questions, so **before planning, reviewing or explaining work in an area, Read the matching rule file(s)**. The non-negotiable rules above apply everywhere; rule files add detail. If two instructions disagree, fix one of them (and tell me), don't pick.

| Rule | Loads when touching | Covers |
| --- | --- | --- |
| `database.md` | `supabase/**` | Migrations, RLS, triggers, functions, seed data |
| `auth.md` | `src/proxy.ts`, `src/lib/supabase/**`, `src/lib/auth*.ts`, `src/app/(auth)/**`, `src/app/auth/**` | Supabase SSR clients, session handling, magic link + OTP, route protection |
| `server-actions.md` | `src/app/**/actions.ts`, `src/lib/**` | Data reads/writes, validation, revalidation, status logic, dates |
| `ui.md` | `src/app/**/*.tsx`, `src/components/**` | shadcn/Tailwind conventions, board, forms, accessibility, responsive |
| `testing.md` | `**/*.test.ts`, `**/*.test.tsx`, `tests/**`, `playwright.config.ts`, `vitest.config.mts` | Unit, RLS and e2e test conventions, fake data |

When you learn something that should change how an area is built, update its rule file in the same task (and `docs/learnings.md`).

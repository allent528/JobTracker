---
paths:
  - "supabase/**"
---

# Database: migrations, RLS, functions

Any change here follows the `db-migration` skill.

## Migrations
- Create with `npx supabase migration new <snake_case_name>`. Never hand-name files, and never edit a migration that has been pushed. Write a new one instead.
- One concern per migration (e.g. `create_orders`, `orders_rls`, `checkout_fn`). Keep them small enough to review.
- Applying to a hosted project is a remote change. Get the owner's OK before `npx supabase db push` or the MCP `apply_migration`.
- After every schema change: regenerate types and run the advisors **locally**: `npx supabase db advisors --type all --level info` and `npx supabase db lint --schema public,private`. Fix warnings before moving on. (The Supabase MCP in `.mcp.json` points at prod; don't use it for dev checks.) `unused_index` INFO on a fresh local DB is expected.
- `npx supabase db query` takes one statement per call (multiple commands fail as a prepared statement).

## Conventions
- Table and column names are snake_case and plural, matching the PRD data model.
- Primary keys: `id uuid primary key default gen_random_uuid()`. A `profiles.id` references `auth.users(id) on delete cascade`.
- Every table has `created_at timestamptz not null default now()`. Mutable tables also get `updated_at`, maintained by a trigger.
- Closed sets (status, work_mode, interview kind/outcome) are `text` + check constraints, **not Postgres enums** (D7). Status values must match `src/lib/status.ts` exactly; changing them means a migration and a TS change in the same PR.
- Salaries are **integers in whole currency units** (`salary_min integer`, `salary_max integer`, `salary_currency text` ISO 4217, default `USD`), with a check that min <= max. Never float.
- Index every foreign key, plus the columns RLS and hot queries filter on.

## Row-level security (mandatory)
- `alter table … enable row level security;` goes in the **same migration** that creates the table, with its policies.
- Separate policies per operation (`select`, `insert`, `update`, `delete`) and per role. Never one `for all` policy with `using (true)`.
- Use `(select auth.uid())` in policies (wrapped, for performance), not raw `auth.uid()` per row.
- Never grant writes to `anon`. Role checks read the role from a table through a `security definer` helper with `set search_path = ''`. Never trust a role sent by the client.
- Clients never write protected columns directly (status, assignments, payments, payouts, approvals). Only server functions (Edge Functions with the secret key, or `security definer` functions) change them.
- Audit/event tables are insert-only: no update or delete policies for anyone.
- Tables in the `supabase_realtime` publication leak through RLS exactly like SELECT.

## JobTracker specifics
- Every table has `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` and an index on it (D8). (Postgres rejects a subquery in `DEFAULT`, so the default is the bare call; policies still use `(select auth.uid())`.) Exceptions: `profiles` uses `id` as the user id, and `status_events.user_id` has no default because only the trigger writes it. Child tables also carry `application_id ... on delete cascade`, and their insert/update policies check the parent application belongs to the same user.
- Each creating migration does `revoke all on table … from anon, authenticated` and then grants `authenticated` only what it needs (column-level where possible, e.g. `grant update (time_zone)` on profiles). Don't rely on Supabase's default grants: they include TRUNCATE (which skips RLS) and may differ on the hosted project.
- Trigger functions live in the unexposed `private` schema (no usage for clients, execute revoked from public/anon/authenticated). Triggers still fire for `authenticated` callers.
- Closed sets other than status mirror `src/lib/closed-sets.ts` (`WORK_MODES`, `INTERVIEW_KINDS`, `INTERVIEW_OUTCOMES`). Write each as `constraint <name> check (<col> in ('a', 'b'))` on one constraint: `src/lib/check-constraints.test.ts` parses that shape from the migrations.
- Links rendered as `href` (`job_url`, `linkedin_url`) have an `^https?://` check, so a stored `javascript:` URL can't exist.
- `status_events` is written **only** by the `after insert or update of status` trigger on `applications` (D5): a `security definer` function with `set search_path = ''`. Clients get a select policy only; no insert, update or delete policy for anyone. Guard with `when (old.status is distinct from new.status)` on update.
- Transitions are not enforced (D6): no transition checks in SQL.
- `profiles` row is created by a trigger on `auth.users` insert; `time_zone` defaults to `UTC` and is validated by a `before insert or update` trigger against `pg_timezone_names` (a check constraint can't query a table), plus Zod in the app.
- Stats (F9) live in SQL views or functions (D13). Views use `security_invoker = true` so RLS applies.
- Develop against the local stack: `npx supabase db reset` must apply every migration cleanly before anything goes to prod. Push to the single hosted project (JobTracker (`skcsrdyqsqkinrrwtdyh`)) only with the owner's OK. Regenerate types from local.

## Storage policies
- Buckets are private unless a file is truly public. Object paths encode ownership (e.g. `<record_id>/<type>/<file>`); policies parse the path with a strict helper and check the *current* relationship.
- Give only the access needed: evidence files get INSERT and SELECT only (no UPDATE, no DELETE).

## Seed data
- `supabase/seed.sql` holds fake test data only. Never real people's data.

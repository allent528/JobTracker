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
- Every table has `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` and an index on it (D8). Exceptions: `profiles` uses `id` as the user id; `status_events.user_id` has no default because only the trigger writes it.
- The default is the bare `auth.uid()`: Postgres rejects a subquery in `DEFAULT`. Policies still use `(select auth.uid())`.
- Child tables tie themselves to the parent with composite foreign keys, not policy subqueries: `applications` has `unique (id, user_id)`, and each child has `foreign key (application_id, user_id) references applications (id, user_id) on delete cascade` (plus an index on those columns). `interview_contacts` also carries `application_id`, with `(interview_id, application_id)` and `(contact_id, application_id)` keys into `interviews`/`contacts` (`unique (id, application_id)` on both). Child policies are then just `user_id = (select auth.uid())`.
- Unique keys on user-owned rows lead with `user_id` (e.g. `interview_contacts unique (user_id, interview_id, contact_id)`), so one user's rows can never collide with another's. Unique checks run before FK checks, and a collision would tell an attacker the other user's row exists.
- Each creating migration does `revoke all on table … from anon, authenticated`, then grants `authenticated` `select, delete` plus column-level `insert (...)` and `update (...)` on content columns only. Clients never write `id`, `user_id`, `created_at`, `updated_at`, or a child's `application_id` after insert (no re-parenting). Don't rely on Supabase's default grants: they include TRUNCATE (which skips RLS) and may differ on the hosted project. A new content column needs adding to both column grants.
- Trigger functions live in the unexposed `private` schema (no usage for clients, execute revoked from public/anon/authenticated). Triggers still fire for `authenticated` callers.
- Closed sets other than status mirror `src/lib/closed-sets.ts` (`WORK_MODES`, `INTERVIEW_KINDS`, `INTERVIEW_OUTCOMES`). Write each as a single named constraint, `constraint <name> check (<col> in ('a', 'b'))`; `src/lib/check-constraints.test.ts` parses only that shape, so other forms go unchecked.
- Text columns have length limits mirrored by `TEXT_LIMITS` in `src/lib/limits.ts`, written as `constraint <table>_<col>_length check (char_length(<col>) <= <n>)`. The same test checks SQL and TS agree.
- Links rendered as `href` (`job_url`, `linkedin_url`) have an `^https?://` check, so a stored `javascript:` URL can't exist. `interviews.location` is free text (see ui.md).
- `applications.date_applied` is set to today in the owner's time zone by a `before insert or update of status` trigger when the status becomes `applied` with no date (F4). Clients may still set it explicitly.
- `status_events.changed_at` defaults to `clock_timestamp()` so events in one transaction order strictly; order history and stats by `changed_at`.
- `status_events` is written **only** by the `after insert or update of status` trigger on `applications` (D5): a `security definer` function with `set search_path = ''`. Clients get a select policy only; no insert, update or delete policy for anyone. Guard with `when (old.status is distinct from new.status)` on update.
- `status_events.from_status` / `to_status` have no check constraint, but the app reads them as `Status`. Renaming or removing a status must update existing `status_events` rows in the same migration as the `applications` check constraint (and `src/lib/status.ts`).
- Transitions are not enforced (D6): no transition checks in SQL.
- `profiles` row is created by a trigger on `auth.users` insert. `time_zone` is null until the app saves the browser's zone on the first signed-in page load (or the owner picks one in `/settings`); server code falls back to UTC. Non-null values are validated by a `before insert or update of time_zone` trigger against `pg_timezone_names` (a check constraint can't query a table), plus Zod in the app.
- Stats (F9) live in SQL views or functions (D13). Views use `security_invoker = true` so RLS applies.
- The `stats_*` functions (`20261118025658_create_stats_functions`) are `stable security invoker` with `set search_path = ''`, and each filters `user_id = (select auth.uid())` itself. Execute is revoked from public, anon and service_role and granted to authenticated only.
- They return raw facts. Status lists arrive as `text[]` parameters from `src/lib/status.ts` (capped at 32 entries, `too_many_statuses` / 22023), and days arrive as `date` parameters.
- Never hard-code statuses in them, and never read `now()` or `current_date` (those are UTC, not the owner's day).
- Develop against the local stack: `npx supabase db reset` must apply every migration cleanly before anything goes to prod. Push to the single hosted project (JobTracker (`skcsrdyqsqkinrrwtdyh`)) only with the owner's OK. Regenerate types from local.

## Storage policies
- Buckets are private unless a file is truly public. Object paths encode ownership (e.g. `<record_id>/<type>/<file>`); policies parse the path with a strict helper and check the *current* relationship.
- Give only the access needed: evidence files get INSERT and SELECT only (no UPDATE, no DELETE).

## Seed data
- `supabase/seed.sql` holds fake test data only. Never real people's data.

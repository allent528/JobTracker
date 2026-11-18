---
name: db-migration
description: The required workflow for any change to the Supabase database: new tables, columns, RLS policies, SQL functions/RPCs, triggers, cron jobs, storage policies, settings. Covers writing the migration, the security review, asking the owner before applying, applying, regenerating types, running the advisors and live checks, and recording it. Use it every time, even for a one-line migration.
---

# Database migration workflow (Supabase)

Targets: the **local** Supabase stack in Docker (develop and verify here: `npx supabase db reset`, RLS checks, advisors) and the single hosted project **JobTracker** (ref `skcsrdyqsqkinrrwtdyh`). Every push to prod is live: run it only after the migration passes locally and the owner explicitly approves that migration for prod. Follow these steps in order.

## 1. Prepare
- Load the `supabase-postgres-best-practices` skill (and `supabase` for Storage, Realtime, cron, Edge Functions).
- Read `.claude/rules/database.md`. Check `docs/learnings.md` for past database mistakes.
- Inspect what exists: earlier migrations, and/or the Supabase MCP `list_tables` (verbose), before changing anything.

## 2. Write the migration
- `npx supabase migration new <snake_case_name>` and edit that file only. **Never edit a migration that's been pushed.** Fix forward with a new one.
- To change an existing function, use `create or replace` with the same signature. If the return type changes, `drop function` then `create`, and re-grant.
- Same migration that creates a table: `enable row level security`, the policies, and `revoke … from anon, authenticated` for anything clients mustn't write.
- Every SECURITY DEFINER function: `set search_path = ''`, fully qualified names, its own `auth.uid()`/ownership check, `revoke execute … from public, anon`, and grant only to the right role.
- Raise stable error codes (`raise exception 'snake_code' using errcode = 'P0001'`) and map them to user-facing copy in the app.

## 3. Review before applying
- Run the **security-reviewer** agent on the migration SQL. Fix what it finds.
- `npx supabase db push --remote --skip-vault --dry-run` to confirm only the intended file(s) will apply to prod. Supabase CLI 3.x targets the **local** database by default; prod commands need `--remote` (see `docs/deploy.md`).

## 4. Ask the owner
Apply only after explicit approval. Use AskUserQuestion with a plain-English summary of what changes, whether existing data is affected, and options: apply / apply + pre-approve small follow-up fixes for this step / show SQL first. Approval for one step doesn't carry over to the next.

## 5. Apply and regenerate
```bash
npx supabase db push --remote --skip-vault --yes   # prod; never --include-seed (seed.sql is fake data)
npm run db:types                    # regenerate the generated database types (from local)
npm run typecheck
```

## 6. Verify live
- Add checks to the live access-control script (e.g. `scripts/check-rls.mjs`, run as `npm run check:rls`) for every new rule, written **as the attacker** (the forbidden action fails) as well as the happy path. Keep fixtures realistic.
- Run it. All must pass.
- Advisors on prod: `npx supabase db advisors --remote --type all --level info` (the Supabase MCP `get_advisors` gives the same). Explain each finding as intended or fixed.

## 7. Record
- `docs/progress.md` entry: what the migration does, checks added, advisor results.
- Anything surprising goes in `docs/learnings.md`.
- If the Supabase MCP errors with "Invalid or expired requestState", ask the user to re-authenticate via `/mcp`.

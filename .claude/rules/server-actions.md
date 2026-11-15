---
paths:
  - "src/app/**/actions.ts"
  - "src/lib/**"
---

# Data layer: Server Actions, validation, domain logic

## Conventions
- Reads happen in Server Components through `src/lib/supabase/server.ts`; writes happen in Server Actions in a colocated `actions.ts` (D1). No API routes for app data in v1.
- Each action: `'use server'` → get the user → parse input with the feature's Zod schema (shared with the form, D14) → one `supabase-js` call → `revalidatePath` for affected pages (D12) → return `{ ok: true, data } | { ok: false, error }`. Don't throw raw database errors at the UI.
- Zod schemas live in `src/lib/schemas/<feature>.ts`. Domain helpers (status labels/order, "days in status", follow-up math) live in `src/lib/` as pure functions with unit tests.
- Statuses: import from `src/lib/status.ts` (`STATUSES`, `ACTIVE_STATUSES`, `CLOSED_STATUSES`, `nextSuggestedStatus`). Any transition is valid (D6).
- Dates: "today" is computed in the owner's `profiles.time_zone` via `src/lib/dates.ts` (D11). Follow-ups are date-only strings (`YYYY-MM-DD`); interviews are `timestamptz`. Never use the server's local time.
- Use the generated `Database` types; no `any` for rows.

## Must / must not
- Never write to `status_events`; changing `applications.status` is enough (the trigger logs it, D5).
- Never pass `user_id` from the client; the column default and RLS set it.
- No ORM, no direct Postgres connection, no secret key (D1b).
- Don't log row contents (contacts, salaries, notes) to the console or error reports.

## Lessons learned
- Reads of one row go through helpers in `src/lib/application-queries.ts` (server-only): validate the id with Zod, filter by `user_id` as well as RLS, and call `notFound()` for a bad, missing or foreign id.
- Updates and deletes chain `.select("id").maybeSingle()`: an RLS-filtered write returns no row rather than an error, so `null` means "not found" and the action says so.
- Map write errors with `writeErrorMessage()` (`src/lib/db-errors.ts`); never return or log the database message, which can quote row values.

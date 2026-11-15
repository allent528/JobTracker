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
- Reads go through `src/lib/application-queries.ts` (server-only). Every query filters by `user_id` as well as RLS. `getApplicationOrNotFound` also validates the id with Zod and calls `notFound()` for a bad, missing or foreign id.
- Stored `status` / `work_mode` text is narrowed to `Status` / `WorkMode` once, in application-queries.ts (safe because of the check constraints and check-constraints.test.ts). Code past that boundary takes `Status`; `isStatus` is only for untrusted input.
- Updates and deletes of an owned row go through `updateOwnApplication` / `deleteOwnApplication` in `actions.ts`, which chain `.select("id").maybeSingle()`: an RLS-filtered write returns no row rather than an error, so `null` becomes `APPLICATION_NOT_FOUND`. Input is parsed with `parseOr(schema, input)`. Step 6 can lift these to a table-generic helper.
- `listPipeline()` gets "days in current status" by embedding the latest status event per application (`status_events(changed_at)` with `.order`/`.limit(1)` on `referencedTable`); no view needed. It also returns `today` and `timeZone` for date math in the owner's zone (`dateInTimeZone`, `daysBetween` in `dates.ts`).
- Application actions revalidate `APPLICATIONS_PATH` and the detail path. When step 7 puts the reminders page at `/`, revalidate `/` too.
- Map write errors with `writeErrorMessage()` (`src/lib/db-errors.ts`); never return or log the database message, which can quote row values.

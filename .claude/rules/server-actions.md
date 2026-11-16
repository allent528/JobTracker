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
- Stored closed-set text (`status`, `work_mode`, interview `kind` / `outcome`) becomes a TS type only through `src/lib/stored.ts` (safe because of the check constraints and check-constraints.test.ts). Code past that boundary takes `Status`; `isStatus` is only for untrusted input.
- Owned-row writes go through `src/lib/owned-rows.ts` (server-only): `updateOwnApplication` / `deleteOwnApplication`, and `insertChild` / `updateOwnChild` / `deleteOwnChild` for notes, contacts and interviews.
- Updates and deletes filter by `user_id` and chain `.select(...).maybeSingle()`. An RLS-filtered write returns no row rather than an error, so `null` becomes the table's message from `NOT_FOUND`.
- Child writes return `{ id, application_id }`, so the action revalidates the right detail page.
- Actions parse with `parseOr(schema, input)` from `src/lib/action-result.ts`; the detail actions wrap id + input parsing in `parseRequest(table, id, schema, input)`. Shared Zod field builders are in `src/lib/schemas/fields.ts`.
- `listPipeline()` gets "days in current status" by embedding each application's newest status event (`status_events(changed_at)` with `.order` and `.limit(1)` on `referencedTable`). No view needed. The query lives in `src/lib/pipeline-query.ts`, outside `server-only`, so `tests/rls/pipeline-query.test.ts` can run it.
- "Today" in the owner's zone comes from `getToday()` in `src/lib/profile.ts` (cached per request). Don't compute it elsewhere. Read the clock only after an awaited request-bound read.
- Revalidation helpers live in `src/lib/revalidate.ts` (server-only): `revalidatePipeline()` (`/applications` and `/`), `revalidateApplication(id)`, and `revalidateAllPages()` for a time zone change. Interview writes also revalidate `INTERVIEW_LIST_PATHS` (`/`).
- F8 reads: `listDueFollowUps(lastDay)` (`src/lib/reminder-query.ts`: unarchived, any status, no lower bound) and `listUpcomingInterviews({ until })` (no `from` = every earlier pending round). The window comes from `reminderWindow(today)`; bucketing is `bucketReminders()`.
- Time zone writes go through `updateOwnTimeZone()` in owned-rows.ts; detection passes `onlyIfUnset` so it never overwrites a saved zone. Zod uses `isSupportedTimeZone()` (`src/lib/time-zones.ts`); the DB trigger is the final check (22023 maps to "That time zone isn't recognized").
- Map write errors with `writeErrorMessage()` (`src/lib/db-errors.ts`); never return or log the database message, which can quote row values.
- Detail-page reads (`listNotes`, `listContacts`, `listInterviews`) are in application-queries.ts; the page fetches them in one `Promise.all` with the history and time zone, and passes them to small section components (`[id]/sections.tsx`).
- Interview times: the form sends a `datetime-local` wall-clock value; the action reads it in `profiles.time_zone` with `localDateTimeToInstant()` and stores a `timestamptz` (no time zone column). Edit forms convert back with `instantToLocalDateTime()`. Display uses `formatDateTimeWithZone()`.
- Picked interviewers live in `interview_contacts`. Create inserts the links after the row; edit deletes links not in the new set and upserts the set (`ignoreDuplicates`, works with the column insert grant). Not atomic: a failed link insert on create deletes the new interview; on edit the row change stays and the error is shown. An atomic RPC is a follow-up.
- The interview schema accepts years 1900–2999 only: `Date.UTC` maps years 0–99 to the 1900s.
- Upcoming interviews for F8: `listUpcomingInterviews({ from, until })` takes owner-zone dates (`startOfDayInstant`) and wraps `selectUpcomingInterviews` in `src/lib/interview-query.ts` (pending only, application not archived, soonest first; tested in `tests/rls/upcoming-interviews.test.ts`). `interviewDueState()` in follow-ups.ts classifies a round as overdue / today / upcoming. Interview writes revalidate `INTERVIEW_LIST_PATHS` in `[id]/actions.ts`.
- supabase-js can't type `.from(table)` for a union of table names; `owned-rows.ts` types the child builder as one table after the caller's row is checked against `TablesInsert<T>` / `TablesUpdate<T>`.

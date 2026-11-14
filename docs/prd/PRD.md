# JobTracker: Product requirements

<!-- The source of truth for WHAT to build. Claude plans against the IDs below, so keep them stable. -->

## Problem and users
A job search means dozens of applications at different stages, each with its own contacts, interview dates and follow-ups. Spreadsheets and inboxes lose track of what's due and what's stalled.

**User:** one person, the owner, tracking their own search. No other accounts, no sharing, no teams. Sign-in exists only to keep the data private.

## Goals / non-goals
**Goals (v1)**
- Record every application and see at a glance where each one stands.
- Never miss a follow-up or interview: what's due today and what's overdue is always visible.
- Keep notes, contacts and interview rounds attached to the application they belong to.
- Show simple numbers on how the search is going.

**Non-goals (v1)**
- Multiple users, sharing, coaches or recruiters viewing data.
- Email or push notifications (in-app only; see L1).
- File uploads, importing jobs from URLs, browser extension, AI features (later steps L2–L4).
- Native mobile apps. The web app must work well on a phone browser, though.

## Features

### F1: Sign-in (single user)
- [ ] Sign in with a Supabase Auth email that contains both a magic link and a 6-digit code; either one signs in (the code covers opening the email on a different device or browser).
- [ ] Public sign-ups are disabled in Supabase Auth settings; an unknown email gets no account.
- [ ] Every page except `/login` and the auth callback redirects to `/login` when signed out.
- [ ] Sign-out ends the session on the device.

### F2: Applications
- [ ] Create an application with: company (required), role title (required), job posting URL, location, work mode (onsite / hybrid / remote), salary range min/max (whole currency units) + currency, source (e.g. LinkedIn, referral), date applied, and a free-text description.
- [ ] Edit and delete an application. Delete asks for confirmation and removes its notes, contacts, interviews and history.
- [ ] Archive instead of delete: archived applications are hidden from the board and lists by default and can be shown with a filter.
- [ ] New applications start in `saved`, or in `applied` if a date applied is set.

### F3: Pipeline views
- [ ] **Board view:** one column per active status (see lifecycle); cards show company, role, days in current status, and next follow-up date. Dragging a card to another column changes its status (F4 rules apply).
- [ ] **Table view:** sortable by company, role, status, date applied, last updated; filter by status, work mode and archived; text search over company and role.
- [ ] Cards within a column are ordered automatically: overdue follow-up first, then by next follow-up date, then by most recently updated. No manual reordering in v1.
- [ ] Closed statuses (`accepted`, `rejected`, `withdrawn`, `ghosted`) are collapsed or filtered out of the board by default.
- [ ] Both views are usable at 375px width.

### F4: Status changes and history
- [ ] Status can only be one of the values in the lifecycle below.
- [ ] Any status can change to any other status. The forward path is only a UI suggestion (e.g. a "Move to Screening" button), not a rule.
- [ ] Every status change, including the initial status on creation, writes a row to `status_events` (from, to, timestamp) through a database trigger, so no code path can skip it. History is shown on the application's detail page.
- [ ] Setting status to `applied` with no date applied sets date applied to today.

### F5: Notes
- [ ] Add, edit and delete timestamped notes on an application (plain text or Markdown).
- [ ] Notes show newest first on the detail page.

### F6: Contacts
- [ ] Add contacts to an application: name (required), role/title, email, phone, LinkedIn URL, notes.
- [ ] Edit and delete contacts.

### F7: Interviews
- [ ] Add interview rounds to an application: type (phone screen, technical, behavioral, onsite, final, other), scheduled date/time with time zone, duration, location or video link, interviewer(s) (pick from the application's contacts or free text), and outcome (pending, passed, failed, cancelled).
- [ ] Upcoming interviews appear in F8's "due" list.
- [ ] Adding the first interview to an application in `applied` or `screening` suggests (does not force) moving it to `interviewing`.

### F8: Reminders and follow-ups (in-app)
- [ ] Each application has an optional next follow-up date and a short follow-up note.
- [ ] The home page shows **Overdue**, **Today**, and **Next 7 days** lists, combining follow-ups and scheduled interviews.
- [ ] Marking a follow-up done clears it and offers to set the next one (e.g. +7 days).
- [ ] "Today" means today in the owner's time zone, stored in `profiles.time_zone` (detected from the browser on first sign-in, editable in settings) so server-rendered lists are correct around midnight.

### F9: Stats dashboard
- [ ] Count of applications per status (active and closed).
- [ ] Applications per week (by date applied) for the last 12 weeks.
- [ ] Response rate: share of applications that reached `screening` or later, out of those that reached `applied`.
- [ ] Average days spent in each stage, computed from `status_events`.
- [ ] All stats exclude archived applications unless a toggle includes them.

## Core lifecycle / state machine
Statuses are stored as `text` with a check constraint (not a Postgres enum, so values can be renamed or removed later), mirrored by one shared TypeScript constant in `src/lib/status.ts`:

| Status | Kind | Meaning |
| --- | --- | --- |
| `saved` | active | Interesting job, not applied yet |
| `applied` | active | Application submitted |
| `screening` | active | Recruiter or initial screen |
| `interviewing` | active | In interview rounds |
| `offer` | active | Offer received |
| `accepted` | closed | Offer accepted |
| `rejected` | closed | Turned down by the company |
| `withdrawn` | closed | Owner withdrew |
| `ghosted` | closed | No response; owner gave up |

Suggested forward path: `saved → applied → screening → interviewing → offer → accepted`, with `rejected`, `withdrawn` or `ghosted` as the usual way out of any active stage. **Transitions are not enforced:** any status may change to any other, because it's a single user and corrections are normal. The owner triggers every transition; nothing changes status automatically. An `after insert or update of status` trigger on `applications` records every change in `status_events`.

## Data model
All tables have `id uuid`, `user_id uuid → auth.users`, `created_at`, and (if mutable) `updated_at`. RLS restricts every row to `user_id = auth.uid()`.

- **profiles**: id (= auth.users.id), time_zone (IANA name, e.g. `America/New_York`).
- **applications**: company, role_title, job_url, location, work_mode, salary_min, salary_max, salary_currency, source, description, status (text + check constraint), date_applied, next_follow_up_on (date), follow_up_note, archived_at.
- **status_events**: application_id, from_status (nullable for creation), to_status, changed_at. Written only by the trigger; no insert, update or delete policies for clients.
- **notes**: application_id, body.
- **contacts**: application_id, name, title, email, phone, linkedin_url, notes.
- **interviews**: application_id, kind, scheduled_at (timestamptz), duration_minutes, location, outcome, notes.
- **interview_contacts**: interview_id, contact_id (join table).

Child rows cascade-delete with their application.

## Non-functional requirements
### Security
- RLS on every table; the browser only ever uses the publishable (anon) key and the signed-in user's session.
- The Supabase secret key is never used by the app in v1. If a server route ever needs it, it lives only in server-only code and Vercel env vars.
- A `security definer` trigger writes `status_events` in the same transaction as the status change, so history can't drift from the current status and clients can't forge or edit history.
- Database access goes through `supabase-js` with the user's session (never an ORM connecting as the database owner, which would bypass RLS).

### Privacy
- The data is the owner's personal job-search information (salaries, contacts' emails and phone numbers). No analytics, tracking scripts or third-party embeds that can read page content.
- No real personal data in seeds, tests, screenshots or fixtures.

### Payments correctness
- Not applicable: the app handles no payments. Salary figures are informational and stored as integers in whole currency units.

### Performance and quality
- Board, table and home pages load in under 1s on a typical connection with 500 applications.
- Works on current Chrome, Safari and Firefox, desktop and mobile widths.
- Keyboard accessible; meets WCAG 2.1 AA contrast.

## Launch plan
<!-- Ordered steps. Claude works one step at a time. -->
1. **Project skeleton:** Next.js (App Router, TypeScript, Tailwind, shadcn/ui) at the repo root with typecheck, lint, test (Vitest) and CI green. Install Docker Desktop, run the local Supabase stack (`npx supabase init`, `npx supabase start`) for development, create one hosted project JobTracker (`skcsrdyqsqkinrrwtdyh`), and add env vars.
2. **Auth (F1):** magic-link login, protected routes via `src/proxy.ts`, sign-ups disabled.
3. **Schema:** migrations for all tables (statuses as text + check constraints, D7), RLS, the `status_events` trigger (D5) and the `profiles` trigger; generate types.
4. **Applications CRUD (F2) + status changes (F4).**
5. **Pipeline views (F3):** table first, then board with drag-and-drop.
6. **Detail page: notes, contacts, interviews (F5–F7).**
7. **Reminders home page (F8).**
8. **Stats dashboard (F9).**
9. **Deploy to Vercel:** production (`main` only) uses JobTracker (`skcsrdyqsqkinrrwtdyh`); preview deployments are turned off (D15). Set Supabase Auth redirect URLs and email templates on prod, link the CLI to prod, apply migrations, smoke test on phone and desktop.

**Known risk:** free-tier Supabase projects pause after about a week without activity. Accepted for v1: unpause from the dashboard when needed. Revisit (scheduled ping or paid plan) if it becomes annoying.

**Later steps (not v1)**
- **L1:** Daily email digest of overdue/today items (Supabase cron + Edge Function + email provider).
- **L2:** Resume and cover letter per application: upload to a private Supabase Storage bucket, record which version was sent.
- **L3:** Import from job sites: paste a posting URL, auto-fill company, title, location and description.
- **L4:** Browser extension to save a job from any job page in one click, with best-effort auto-fill: site-specific readers for LinkedIn and Indeed, schema.org `JobPosting` data where the page has it, and otherwise the URL and page title only (owner fills in the rest). Reuses L3's page parsing.

## Technical decisions
Settled 2026-11-14. Change one only by editing this table and noting why in `docs/progress.md`.

| ID | Decision | Chosen | Why |
| --- | --- | --- | --- |
| D1 | Data access | Server Components + Server Actions via `@supabase/ssr`; RLS on every table as the backstop | Server-rendered pages, protected routes, one security model |
| D1b | Query layer | `supabase-js` + generated types; no ORM | An ORM connecting as the database owner bypasses RLS |
| D2 | Environments | Local Supabase stack in Docker for development; one hosted project, JobTracker (`skcsrdyqsqkinrrwtdyh`), for production | Fast, free, disposable dev database; migrations are tested locally before prod |
| D3 | Repo shape | Single Next.js app at the repo root | Monorepo only if the browser extension (L4) arrives |
| D4 | Testing | Vitest for pure logic; SQL scripts for RLS checks; Playwright for 2–3 key flows, signing in a test user via the local admin API; all against the local stack | Fast, deterministic, never touches prod; the local mail catcher (Mailpit) is there for manual magic-link checks |
| D5 | Status history | `after insert or update of status` trigger writes `status_events` | No code path can skip the log |
| D6 | Transitions | Not enforced; any status → any status, all logged | Single user; corrections are normal |
| D7 | Status storage | `text` + check constraint, mirrored by a TS constant | Easier to rename or remove than an enum |
| D8 | Ownership | `user_id` + RLS on every table despite single user | Protects data if the anon key leaks; leaves multi-user possible |
| D9 | Board order | Automatic (overdue, follow-up date, last updated); no manual drag-reorder | No position column or fractional indexing in v1 |
| D10 | Removal | Archive is the everyday action; hard delete with confirmation | Keeps history for stats |
| D11 | Time zones | `profiles.time_zone`, used by server code to compute "today" | Server Components don't know the browser's time zone |
| D12 | UI updates | Server Actions + `revalidatePath`; `useOptimistic` for board drags | No client data cache library needed |
| D13 | Stats | SQL views/functions (window queries over `status_events`) | One source of truth; cheap at this scale |
| D14 | Forms | Zod schemas shared by forms and Server Actions; react-hook-form + shadcn form components | Same validation on client and server |
| D15 | Previews | Vercel preview deployments off; only `main` deploys, to production. Test locally first | No hosted dev project to point previews at, and previews must never touch real data |
| D16 | Sign-in | Magic link plus 6-digit email code (PKCE) | A link opened in a different browser fails under PKCE |

## Open questions
<!-- Each with a proposed default. Claude uses the default and notes it in docs/progress.md. -->
- **Default currency?** Default: USD, editable per application.
- **Board drag-and-drop library?** Default: `@dnd-kit/core`.
- **Is "ghosted" set automatically after N days with no response?** Default: no. Show a "no activity in 21 days" hint and let the owner decide.
- **Charts library for F9?** Default: Recharts (via shadcn/ui charts).
- **Date-only vs timestamp for follow-ups?** Default: date only (`next_follow_up_on date`); interviews use `timestamptz`.

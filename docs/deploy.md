# Deploy runbook (launch step 9)

How JobTracker goes live: the hosted Supabase project **JobTracker** (`skcsrdyqsqkinrrwtdyh`, production, D2) plus one Vercel project that deploys `main` to production only (D15).

Who does what:
- **Owner**: anything in a dashboard (Supabase, Vercel), anything that needs a password, and the smoke test.
- **Claude**: the CLI steps in part B, **one at a time, each only after the owner says "go" for that step**. Approval for one step doesn't carry over to the next.

Nothing in this file has been run yet. Tick the boxes as you go.

## Order at a glance

| # | Step | Who | Section |
| --- | --- | --- | --- |
| 1 | Merge the deploy-prep PR; check the project isn't paused | Owner | A1 |
| 2 | Reset the database password | Owner | A2 |
| 3 | Auth settings: sign-ups off, OTP, email template, rate limits, SMTP | Owner | A3 |
| 4 | Check the Data API exposes only `public` | Owner | A4 |
| 5 | `supabase login` | Owner | B1 |
| 6 | Link the CLI to prod | Claude (approval) | B2 |
| 7 | Pre-push checks + `db push --dry-run` | Claude (approval) | B3 |
| 8 | `db push` (9 migrations) | Claude (approval) | B4 |
| 9 | Advisors, lint, grants/RLS spot checks, type drift | Claude (approval) | B5–B7 |
| 10 | Add the owner's user | Owner | A5 |
| 11 | Create the Vercel project and first deploy | Owner | A6 |
| 12 | Site URL and redirect URLs | Owner | A7 |
| 13 | Smoke test on phone and desktop | Owner (Claude can guide) | C |

The migrations go in before the first Vercel deploy so the app never runs against a missing schema. A5–A7 can't be done earlier: A5 is easiest after the schema exists (its trigger creates the profile), and A7 needs the Vercel URL from A6.

---

## A. Owner: dashboard steps

### A1. Merge and wake the project
- [ ] **Do:** merge the deploy-prep PR into `main` (through GitHub; never push to `main` directly).
- [ ] **Do:** open the Supabase dashboard, project JobTracker. If it shows "Paused", click **Restore project** and wait until it's healthy (see part E).
- **Verify:** the project home shows it as active, and Table Editor opens.

### A2. Reset the database password
An owner to-do since step 1. Part B's `db push` and `migration list` may ask for this password (the login token from B1 may be enough; if the CLI doesn't ask, nothing more is needed).
- [ ] **Do:** Project Settings → Database → **Reset database password**. Generate a long random one and save it in your password manager. Don't paste it into chat, a file in the repo, or a commit.
- **Verify:** the password manager entry exists; the dashboard shows no error.

### A3. Auth settings
Do these before the first sign-in. Write down any value you change (old and new) in case you need to undo it.

1. [ ] **Sign-ups off.** Authentication → Sign In / Providers → turn off **Allow new users to sign up**. Save.
   - **Verify:** the toggle stays off after a page reload.
2. [ ] **Email OTP.** Authentication → Sign In / Providers → **Email**: Email provider on, **Email OTP Length = 6**, **Email OTP Expiration = 900** seconds. Save.
   - **Verify:** reload; both values stick. (The app's code field expects exactly 6 digits, `OTP_LENGTH` in the app.)
3. [ ] **Magic Link template.** Authentication → Emails → Templates → **Magic Link**. This is the same text as `supabase/templates/magic_link.html`.
   - Subject:
     ```
     Your JobTracker sign-in link and code
     ```
   - Body (paste as is, the `{{ }}` parts are Supabase variables):
     ```html
     <h2>Sign in to JobTracker</h2>
     <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
     <p>Or enter this code on the sign-in page: <strong>{{ .Token }}</strong></p>
     <p>The link and code expire in 15 minutes. If you didn't ask to sign in, ignore this email.</p>
     ```
   - **Verify:** the template preview shows the link and a code placeholder. The link must start with `{{ .SiteURL }}/auth/confirm`, not `{{ .ConfirmationURL }}` (that one skips the app's `/auth/confirm` route).
4. [ ] **Rate limits.** Authentication → Rate Limits. The defaults are fine for one user; check they're not 0. With the built-in email sender the email limit is fixed and very low (about 2 emails an hour for the whole project), so don't request codes in a loop during the smoke test.
   - **Verify:** you read the page; nothing is set to 0.
5. [ ] **Email sender (decision).** The built-in sender is for testing: it's rate-limited and only delivers to addresses that are members of your Supabase organization. If your sign-in email is the address you use for Supabase, it works. If not, or if you want reliable delivery, set up custom SMTP (Authentication → Emails → SMTP Settings) with a transactional email provider. Your call; not needed to launch if your address is a team member.
   - **Verify:** in part C the sign-in email arrives within a minute.
6. Leave everything else (other providers, MFA, anonymous sign-ins) off.

Don't run `npx supabase config push`: it would copy the local settings (`site_url` = localhost, rate limit 100) to prod. The dashboard is the source of truth for prod auth settings.

### A4. Data API schemas
- [ ] **Do:** Project Settings → Data API (or API). **Exposed schemas** should be `public` and `graphql_public` only. `private` must **not** be listed (the trigger functions live there).
- **Verify:** the list matches. If `private` is there, remove it and save.

### A5. Add your user (after B4)
- [ ] **Do:** Authentication → Users → **Add user → Create new user**. Enter your email, generate a long random password (you'll never use it; sign-in is by code or link), and tick **Auto Confirm User**.
- **Verify:** the user shows as confirmed. Then ask Claude to run the profile check in B6 (one profile row, `time_zone` still empty until your first sign-in).
- If you added the user before B4: fine. Migration 2 backfills a profile for every existing user.

### A6. Vercel project
1. [ ] **Import:** vercel.com → Add New → Project → import the JobTracker GitHub repository.
   - Framework preset: **Next.js**. Root directory: `./` (the repo root).
   - Build command: default (`next build`). Install command: override to `npm ci` (installs exactly what's in `package-lock.json`, like CI). Output directory: default.
2. [ ] **Environment variables** (on the import screen, before the first deploy). Add exactly two, scoped to **Production only** (untick Preview and Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://skcsrdyqsqkinrrwtdyh.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the **publishable** key from Supabase → Project Settings → API Keys (starts `sb_publishable_`).
   - Never add the secret / `service_role` key to Vercel. v1 doesn't use it.
   - `NEXT_PUBLIC_*` values are baked into the build. If you change either one later, redeploy (Deployments → ⋯ → Redeploy) or the app keeps the old value.
3. [ ] **Deploy.** Wait for the first build to finish.
   - **Verify:** the build log ends with "Ready"/success; it reports Node 22 (the repo pins `engines.node` to `22.x`, which overrides the dashboard Node setting; if Vercel warns about that, set Settings → Build and Deployment → Node.js Version to 22.x too).
4. [ ] **Production branch:** Settings → Environments → Production → branch tracking is `main`.
5. [ ] **Previews off (D15):** Settings → Git → **Ignored Build Step** → Behavior **Only build production**. If that option isn't offered, choose "Run my Bash script" and paste:
   ```sh
   if [ "$VERCEL_ENV" = "production" ]; then exit 1; else exit 0; fi
   ```
   (Exit 1 means "build", exit 0 means "skip".)
   - **Verify:** the next PR you open shows the Vercel check as skipped/canceled, not a preview URL.
6. [ ] **No tracking:** leave Web Analytics and Speed Insights **off** (CLAUDE.md: no analytics or tracking).
7. [ ] **Optional:** Settings → Functions → Function Region: pick the region closest to the Supabase project's region (Supabase → Project Settings → General shows it). Fewer round trips per page.
- **Note the production URL:** Settings → Domains, usually `https://<project-name>.vercel.app`. A7 and part C use it as `<prod-url>`.

### A7. Site URL and redirect URLs
- [ ] **Do:** Supabase → Authentication → URL Configuration:
  - **Site URL** = `<prod-url>` (for example `https://jobtracker-xyz.vercel.app`, no trailing slash).
  - **Redirect URLs**: add `<prod-url>/**`. Remove any `localhost` entries; prod should never send users to localhost.
- **Verify:** in part C, the link in the sign-in email starts with `<prod-url>/auth/confirm`.
- If you later add a custom domain, update both values; no redeploy is needed, since they live in Supabase.

---

## B. Claude: CLI steps (each needs the owner's "go")

Supabase CLI 3.x (the version in `package.json`) targets the **local** stack unless a command gets `--remote`. Every prod command below has `--remote`; every database command without it is local. Changes to a hosted project also need `--yes`. `db push` also gets `--skip-vault`: the project has no Vault secrets configured, and the flag guards against a push ever sending any.

Run these from the main checkout (`C:/Users/ariac/Repos/JobTracker`, on an up-to-date `main`), not a worktree: `link` saves the project ref in that folder's `supabase/.temp/` (git-ignored).

**Password handling:** commands marked "needs the DB password" use the password from A2. Before starting Claude Code for part B, set it in that PowerShell window so it never appears in chat or history:
```powershell
$env:SUPABASE_DB_PASSWORD = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Supabase DB password')).Password
```
The typed password isn't shown or saved in history. Claude never prints the environment (no `env`, `set` or `echo` of it). After B6, clear it: `Remove-Item Env:SUPABASE_DB_PASSWORD` (or close that window).

Or run those commands yourself in your own terminal and paste the output (it contains no secrets).

### B1. Log in (owner)
- [ ] **Owner runs** in their own terminal: `npx supabase login` (opens the browser; approve).
- **Verify:** `npx supabase projects list` shows JobTracker (`skcsrdyqsqkinrrwtdyh`).

### B2. Link (Claude, approval 1)
```bash
npx supabase link --project-ref skcsrdyqsqkinrrwtdyh
```
- Read-only on prod; it records the ref locally. If it prints a "local config differs from remote" diff, that's expected (local auth settings differ on purpose). Don't act on it.
- **Verify:** `supabase/.temp/project-ref` contains `skcsrdyqsqkinrrwtdyh`; `git status` shows nothing new (the folder is ignored).

### B3. Pre-push checks and dry run (Claude, approval 2; read-only)
```bash
npx supabase migration list --remote          # needs the DB password
npx supabase db query --remote --read-only "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and c.relkind in ('r', 'v', 'm', 'f', 'p')"
npx supabase db push --remote --skip-vault --dry-run   # needs the DB password
```
- **Expect:** the remote column of `migration list` is empty; the query returns no tables (prod is empty); the dry run lists exactly the 9 files below, in this order, and nothing else.
- **If not:** stop and tell the owner. Something already exists on prod (an earlier experiment or dashboard change) and needs a decision before pushing. Don't use `--include-all` or `migration repair` without the owner's OK.

The 9 migrations, in apply order:

| # | File | What it does |
| --- | --- | --- |
| 1 | `20261115014501_create_private_helpers.sql` | Unexposed `private` schema (no client access) and the `set_updated_at()` trigger function. |
| 2 | `20261115014503_create_profiles.sql` | `profiles` (one row per user, `time_zone`); RLS select/update own; time-zone validation trigger; `handle_new_user` trigger on `auth.users`; backfills profiles for existing users. |
| 3 | `20261115014504_create_applications.sql` | `applications` with all PRD columns, check constraints (statuses, work mode, URLs, salary, currency, lengths), column grants, per-operation RLS, `updated_at` and `date_applied` triggers. |
| 4 | `20261115014506_create_status_events.sql` | Read-only status history; a security definer trigger logs the initial status and every change. No client writes. |
| 5 | `20261115014508_create_notes.sql` | `notes` per application, RLS, column grants, `updated_at` trigger. |
| 6 | `20261115014510_create_contacts.sql` | `contacts` per application (http(s) LinkedIn URL check), RLS, column grants. |
| 7 | `20261115014512_create_interviews.sql` | `interviews` per application (kind, outcome, duration checks), RLS, column grants. |
| 8 | `20261115014513_create_interview_contacts.sql` | Join rows linking interviews to contacts of the same application and user; select/insert/delete only. |
| 9 | `20261118025658_create_stats_functions.sql` | Four `security invoker` stats RPCs (`stats_status_counts`, `stats_applied_per_day`, `stats_response_counts`, `stats_stage_durations`); execute for `authenticated` only. |

All nine passed `npx supabase db reset`, the RLS suite (43 tests), the advisors and the security reviews locally. No data is affected: prod has none yet.

### B4. Push (Claude, approval 3; changes prod)
```bash
npx supabase db push --remote --skip-vault --yes   # needs the DB password
```
- Never add `--include-seed` (seed.sql is for local only) or `--include-roles`.
- **Verify:** the command ends without error, and `npx supabase migration list --remote` (needs the DB password) shows all 9 in both columns.
- If it fails partway, stop and see part D.

### B5. Advisors and lint (Claude, approval 4; read-only)
```bash
npx supabase db advisors --remote --type all --level info
npx supabase db lint --remote --schema public,private
```
- **Expect:** `unused_index` INFO on the empty tables (expected, same as local). Auth-config warnings (for example about leaked-password protection) don't apply: there is no password sign-in in the app. Anything else: explain it as intended or stop and fix it forward (part D).
- **Verify:** lint reports no errors.

### B6. Grants and RLS spot checks (same approval as B5; read-only)
Run each query with `--remote` and again without it (local stack, if running) and compare. The output should be identical, apart from local-only roles.
```bash
# RLS on for every public table (expect 7 rows, all true)
npx supabase db query --remote --read-only "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1"

# Policies per table and command
npx supabase db query --remote --read-only "select tablename, cmd, count(*) from pg_policies where schemaname = 'public' group by 1, 2 order by 1, 2"

# Table privileges for client roles (expect no anon rows; status_events: authenticated SELECT only, nothing for service_role)
npx supabase db query --remote --read-only "select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role') order by 1, 2, 3"

# Column-level insert/update grants (content columns only; compare with local)
npx supabase db query --remote --read-only "select table_name, column_name, grantee, privilege_type from information_schema.column_privileges where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE') order by 1, 2, 3, 4"

# Function ACLs (step 8 follow-up). Expect each stats_* proacl to list only postgres and authenticated:
# no anon=, no service_role=, and no entry starting with "=X" (that would be PUBLIC).
# private.* functions: no anon, authenticated or PUBLIC entries.
# Expect no NULL: a NULL proacl means the default, which lets PUBLIC execute.
npx supabase db query --remote --read-only "select n.nspname, p.proname, coalesce(p.proacl::text, 'NULL = PUBLIC execute') as acl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') order by 1, 2"

# Signup trigger present (expect on_auth_user_created)
npx supabase db query --remote --read-only "select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal"

# After A5: one profile, time zone not yet set (counts only, no personal data)
npx supabase db query --remote --read-only "select count(*) as profiles, count(time_zone) as with_zone from public.profiles"
```
- No RLS test suite, e2e or seed runs against prod (testing rule). These catalog queries read no user data.

### B7. Type drift (same approval as B5; read-only)
Run in Git Bash (Claude's Bash tool):
```bash
npx supabase gen types typescript --remote --schema public > "${TMP:-/tmp}/prod.database.types.ts"
git diff --no-index --stat src/types/database.types.ts "${TMP:-/tmp}/prod.database.types.ts"
```
- **Expect:** no differences. Any difference means prod's schema isn't what the app was built against: stop and investigate. Never overwrite `src/types/database.types.ts` from prod (it's generated from local).

After part B, Claude records the results (advisor findings, ACLs, drift) in `docs/progress.md`.

---

## C. Smoke test (owner, phone and desktop)

Use the real production URL. Use obviously fake test data ("Smoke Test Co", "Test Contact"), and delete it at the end. Don't request more sign-in emails than needed (rate limit, A3.4).

**Desktop (a current Chrome, Edge or Firefox)** and **phone (Safari on iPhone or Chrome on Android)**; each check says where.

1. [ ] **Signed-out redirect** (phone): open `<prod-url>/applications`. **Expect:** the sign-in page.
2. [ ] **Sign in with the code** (phone): enter your email → the email arrives (subject "Your JobTracker sign-in link and code") → enter the 6-digit code. **Expect:** the Reminders page, with "Today is <date> in <your zone>" showing your zone (detected on first sign-in).
3. [ ] **Unknown email** (phone, optional; costs one email): sign out, enter an address that has no account. **Expect:** the same "If <email> has an account, we sent it…" answer, no email, and no new user under Supabase → Authentication → Users (sign-ups off).
4. [ ] **Sign in with the link** (desktop): request a sign-in, open the email, click **Sign in**. **Expect:** the link starts with `<prod-url>/auth/confirm` (not localhost), and you land on Reminders signed in. Click the same link again: **Expect:** back on sign-in with "That sign-in link is invalid or has expired.".
5. [ ] **Create** (desktop): Applications → New application, "Smoke Test Co" / "Test Role", no date applied → Save. **Expect:** the detail page, status Saved.
6. [ ] **Move on the board** (desktop): drag the card from Saved to Applied. Reload. **Expect:** still Applied; the detail page's history shows "Saved → Applied" and Date applied is today.
7. [ ] **Move on the phone**: open the board, use the card's **Move** menu (or long-press and drag) to Screening. **Expect:** it sticks after reload; the page doesn't scroll sideways.
8. [ ] **Table** (desktop): `?view=table`, sort by company, search "smoke". **Expect:** one row.
9. [ ] **Notes, contacts, interview** (phone or desktop): on the detail page add a note, add a contact "Test Contact", add an interview for tomorrow with that contact ticked. **Expect:** the "Move the application to Interviewing?" banner; accept it. Edit the note; reload; everything is still there.
10. [ ] **Reminders** (desktop): edit the application, set Next follow-up to today. **Expect:** it shows under **Today** on the Reminders page, and the interview under **Next 7 days**. Click **Mark done**, keep the suggested date. **Expect:** it moves to Next 7 days.
11. [ ] **Stats** (desktop and phone): open Stats. **Expect:** Interviewing 1, the weekly chart shows 1 this week, the response rate shows 1 of 1; no sideways scroll on the phone.
12. [ ] **Archive** (desktop): Archive the application. **Expect:** gone from the board and Reminders; Stats shows the empty state; the table shows it only with "Show archived"; Unarchive brings it back.
13. [ ] **Settings** (phone): the time zone matches yours; change it and back.
14. [ ] **Clean up**: delete "Smoke Test Co" (confirm the dialog). **Expect:** board, Reminders and Stats are empty again.
15. [ ] **Sign out** (both devices). **Expect:** the sign-in page; opening `<prod-url>/` sends you back to sign-in.
16. [ ] **Logs** (desktop): Vercel → project → Logs for the last hour, and Supabase → Logs → Auth. **Expect:** no errors, and no emails, codes or application data printed.

If any step fails, note the step number and what you saw (a screenshot without personal data is fine) and hand it to Claude; it goes through the `validate-fix` workflow.

---

## D. Rollback

**App (Vercel)**
- A bad deploy: Vercel → Deployments → the previous good production deployment → ⋯ → **Instant Rollback** (on the Hobby plan, to the immediately previous one). It's instant and doesn't rebuild.
- After a rollback, new pushes to `main` don't go live automatically until you promote one (Deployments → ⋯ → Promote / Undo Rollback). Fix the bug through a PR first.
- The permanent fix is a revert PR or a fix PR merged to `main`, never a direct push to `main`.
- Changed an env var and things broke: set it back and redeploy (values are baked in at build time).

**Database (migrations are forward-only)**
- There is no "down" migration. Never edit a migration that has applied on prod, and never `migration repair` or delete history rows without the owner's OK.
- `db push` applies pending files in order; a file that errors stops the push. Files before it stay applied; the failed file is rolled back, as Postgres runs it in a transaction (confirm with `npx supabase migration list --remote`).
- If one fails:
  1. Stop. Don't retry or edit anything on prod by hand (dashboard SQL editor included).
  2. Run `npx supabase migration list --remote` (needs the DB password) and save the error text. That shows where prod stands.
  3. Find out why prod differs from local (an object that already existed, a role or extension difference), reproduce it locally, and fix forward with a **new** migration through the `db-migration` skill. Verify it with `db reset`, the RLS suite and the advisors locally.
  4. Ask the owner, then push again (B3 dry run first).
- The app needs all 9 migrations. If prod ends up partly migrated, keep sign-in closed (don't share the URL; you're the only user anyway) until the push completes.
- Later releases: keep migrations backward compatible with the deployed app (add first, remove in a later release), so a Vercel rollback still works against the newer schema.
- Backups: the Free plan has no point-in-time restore. Before any future migration that changes existing data, the owner can take a dump (`npx supabase db dump --remote --data-only -f <a path outside the repo>`, check `--help` first). It contains your personal data: keep it out of the repo, encrypted, and delete it when done.

**Auth settings**
- Revert by hand to the values you wrote down in A3. Nothing in the repo changes prod auth settings.

---

## E. Paused project

Free Supabase projects pause after about a week without activity.
- **Symptoms:** sign-in hangs or fails, pages time out or show "Something went wrong", Vercel logs show fetch timeouts or 5xx from `skcsrdyqsqkinrrwtdyh.supabase.co`.
- **Check first, before debugging code:** Supabase dashboard → JobTracker. If it says Paused, click **Restore project**. It takes a few minutes; data is kept.
- **Verify:** sign in again (part C step 2).
- **Avoiding it:** use the app at least once a week, or upgrade the project to a paid plan. A scheduled "keep-alive" ping would be another automated thing touching prod; only add one if the owner decides to.

---

## Deploy-readiness notes (checked 2026-11-18 without touching prod)

- **Node:** `package.json` now pins `engines.node` to `22.x`, the version CI tests on. Vercel uses it over the dashboard setting. `@supabase/supabase-js` needs Node 22 or newer, so an older Vercel default would break the app.
- **Install on Vercel:** the `prepare` script now runs `scripts/install-hooks.mjs`, which skips when there's no git checkout. The old `git config core.hooksPath .githooks` would fail `npm ci` on a build machine without a `.git` folder.
- **Lockfile:** includes the Linux x64 binaries (next-swc, lightningcss, tailwind oxide) since step 1, and pins `react-is` to 19.3.0 for recharts. `npm ci` installs exactly that.
- **`next.config.ts`:** `cacheComponents` and `partialPrefetching` are standard Next 16 features that Vercel supports. `logging.serverFunctions: false` only affects the dev terminal; production doesn't log Server Function arguments either way. The Turbopack CSS rule is what CI's `next build` already uses.
- **Fonts:** none to download. The app self-hosts Archivo (SIL OFL 1.1) through `next/font/local` from a committed file (`src/app/fonts/archivo-latin-wght-normal.woff2`, licence beside it), so the build and the browser make no font requests to a third party.
- **Theme:** dark mode follows the OS setting (`prefers-color-scheme`); there's no in-app toggle and nothing to configure on Vercel.
- **Env:** the app reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase/env.ts`). There's no hard-coded localhost and no `emailRedirectTo`; the magic link comes from the Site URL (A7).
- **Build without secrets:** `next build` passes with the CI placeholder env, so it reaches no database at build time.

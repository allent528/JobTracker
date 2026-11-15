-- applications (F2, F4, F8). Status is text + check constraint (D7), mirrored by STATUSES in
-- src/lib/status.ts; work_mode mirrors WORK_MODES in src/lib/closed-sets.ts. Change both together.
-- Transitions are not enforced (D6). History is logged by the status_events trigger (D5).
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null,
  role_title text not null,
  job_url text,
  location text,
  work_mode text,
  salary_min integer,
  salary_max integer,
  salary_currency text not null default 'USD',
  source text,
  description text,
  status text not null default 'saved',
  date_applied date,
  next_follow_up_on date,
  follow_up_note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_company_not_blank check (btrim(company) <> ''),
  constraint applications_role_title_not_blank check (btrim(role_title) <> ''),
  constraint applications_status_check check (status in (
    'saved', 'applied', 'screening', 'interviewing', 'offer',
    'accepted', 'rejected', 'withdrawn', 'ghosted'
  )),
  constraint applications_work_mode_check check (work_mode in ('onsite', 'hybrid', 'remote')),
  -- Only web links, so a stored URL can never become a javascript: href.
  constraint applications_job_url_http check (job_url ~* '^https?://'),
  constraint applications_salary_min_nonnegative check (salary_min >= 0),
  constraint applications_salary_max_nonnegative check (salary_max >= 0),
  constraint applications_salary_range check (salary_min <= salary_max),
  constraint applications_salary_currency_iso check (salary_currency ~ '^[A-Z]{3}$')
);

create index applications_user_id_idx on public.applications (user_id);

alter table public.applications enable row level security;

revoke all on table public.applications from anon, authenticated;
grant select, insert, update, delete on table public.applications to authenticated;

create policy applications_select_own on public.applications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy applications_insert_own on public.applications
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy applications_update_own on public.applications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy applications_delete_own on public.applications
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function private.set_updated_at();

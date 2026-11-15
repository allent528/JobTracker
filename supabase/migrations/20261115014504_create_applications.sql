-- applications (F2, F4, F8). Status is text + check constraint (D7), mirrored by STATUSES in
-- src/lib/status.ts; work_mode mirrors WORK_MODES and the length limits mirror TEXT_LIMITS
-- (src/lib/closed-sets.ts, src/lib/limits.ts). Transitions are not enforced (D6).
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
  -- Target of the children's (application_id, user_id) foreign keys.
  constraint applications_id_user_id_key unique (id, user_id),
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
  constraint applications_salary_currency_iso check (salary_currency ~ '^[A-Z]{3}$'),
  constraint applications_company_length check (char_length(company) <= 200),
  constraint applications_role_title_length check (char_length(role_title) <= 200),
  constraint applications_job_url_length check (char_length(job_url) <= 2048),
  constraint applications_location_length check (char_length(location) <= 200),
  constraint applications_source_length check (char_length(source) <= 200),
  constraint applications_description_length check (char_length(description) <= 20000),
  constraint applications_follow_up_note_length check (char_length(follow_up_note) <= 500)
);

create index applications_user_id_idx on public.applications (user_id);

alter table public.applications enable row level security;

-- Clients write content columns only; id, user_id and timestamps come from defaults and triggers.
revoke all on table public.applications from anon, authenticated;
grant select, delete on table public.applications to authenticated;
grant insert (
  company, role_title, job_url, location, work_mode, salary_min, salary_max, salary_currency,
  source, description, status, date_applied, next_follow_up_on, follow_up_note, archived_at
) on table public.applications to authenticated;
grant update (
  company, role_title, job_url, location, work_mode, salary_min, salary_max, salary_currency,
  source, description, status, date_applied, next_follow_up_on, follow_up_note, archived_at
) on table public.applications to authenticated;

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

-- F4: moving to applied with no date applied sets it to today in the owner's time zone. In the
-- database for the same reason as D5: no code path can skip it. Not a transition check (D6).
-- Invoker rights: RLS lets the caller read only their own profile, which is the row's owner
-- whenever the insert or update is allowed at all.
create function private.set_date_applied()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.date_applied := (now() at time zone coalesce(
    (select p.time_zone from public.profiles p where p.id = new.user_id),
    'UTC'
  ))::date;
  return new;
end;
$$;

revoke execute on function private.set_date_applied() from public, anon, authenticated;

create trigger applications_set_date_applied
  before insert or update of status on public.applications
  for each row
  when (new.status = 'applied' and new.date_applied is null)
  execute function private.set_date_applied();

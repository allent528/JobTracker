-- interviews (F7): interview rounds on an application. kind and outcome mirror INTERVIEW_KINDS
-- and INTERVIEW_OUTCOMES in src/lib/closed-sets.ts (D7); change both together.
-- interviewers holds free-text names; picked contacts go in interview_contacts.
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  kind text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer,
  location text,
  interviewers text,
  outcome text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_kind_check check (kind in (
    'phone_screen', 'technical', 'behavioral', 'onsite', 'final', 'other'
  )),
  constraint interviews_outcome_check check (outcome in ('pending', 'passed', 'failed', 'cancelled')),
  constraint interviews_duration_minutes_range check (duration_minutes between 1 and 1440)
);

create index interviews_user_id_scheduled_at_idx on public.interviews (user_id, scheduled_at);
create index interviews_application_id_idx on public.interviews (application_id);

alter table public.interviews enable row level security;

revoke all on table public.interviews from anon, authenticated;
grant select, insert, update, delete on table public.interviews to authenticated;

create policy interviews_select_own on public.interviews
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy interviews_insert_own on public.interviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy interviews_update_own on public.interviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy interviews_delete_own on public.interviews
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function private.set_updated_at();

-- interviews (F7): interview rounds on an application. kind and outcome mirror INTERVIEW_KINDS
-- and INTERVIEW_OUTCOMES in src/lib/closed-sets.ts (D7).
-- The (application_id, user_id) foreign key ties each round to an application of the same user.
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null,
  kind text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer,
  location text,
  interviewers text,
  outcome text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of interview_contacts' (interview_id, application_id) foreign key.
  constraint interviews_id_application_id_key unique (id, application_id),
  constraint interviews_application_fkey foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade,
  constraint interviews_kind_check check (kind in (
    'phone_screen', 'technical', 'behavioral', 'onsite', 'final', 'other'
  )),
  constraint interviews_outcome_check check (outcome in ('pending', 'passed', 'failed', 'cancelled')),
  constraint interviews_duration_minutes_range check (duration_minutes between 1 and 1440),
  constraint interviews_location_length check (char_length(location) <= 2048),
  constraint interviews_interviewers_length check (char_length(interviewers) <= 500),
  constraint interviews_notes_length check (char_length(notes) <= 20000)
);

comment on column public.interviews.location is
  'Place or video link. Free text: render as a link only if it matches ^https?://.';
comment on column public.interviews.interviewers is
  'Free-text interviewer names; interviewers picked from contacts are in interview_contacts.';

create index interviews_user_id_scheduled_at_idx on public.interviews (user_id, scheduled_at);
create index interviews_application_id_user_id_idx on public.interviews (application_id, user_id);

alter table public.interviews enable row level security;

revoke all on table public.interviews from anon, authenticated;
grant select, delete on table public.interviews to authenticated;
grant insert (application_id, kind, scheduled_at, duration_minutes, location, interviewers, outcome, notes)
  on table public.interviews to authenticated;
grant update (kind, scheduled_at, duration_minutes, location, interviewers, outcome, notes)
  on table public.interviews to authenticated;

create policy interviews_select_own on public.interviews
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy interviews_insert_own on public.interviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy interviews_update_own on public.interviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy interviews_delete_own on public.interviews
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function private.set_updated_at();

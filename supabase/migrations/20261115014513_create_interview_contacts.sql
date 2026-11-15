-- interview_contacts (F7): which of the application's contacts were interviewers in a round.
-- Rows are immutable: add or remove them, never update. The composite foreign keys make the
-- interview, the contact and the application one application of one user.
create table public.interview_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null,
  interview_id uuid not null,
  contact_id uuid not null,
  created_at timestamptz not null default now(),
  constraint interview_contacts_unique unique (interview_id, contact_id),
  constraint interview_contacts_application_fkey foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade,
  constraint interview_contacts_interview_fkey foreign key (interview_id, application_id)
    references public.interviews (id, application_id) on delete cascade,
  constraint interview_contacts_contact_fkey foreign key (contact_id, application_id)
    references public.contacts (id, application_id) on delete cascade
);

create index interview_contacts_user_id_idx on public.interview_contacts (user_id);
create index interview_contacts_application_id_user_id_idx
  on public.interview_contacts (application_id, user_id);
create index interview_contacts_interview_id_application_id_idx
  on public.interview_contacts (interview_id, application_id);
create index interview_contacts_contact_id_application_id_idx
  on public.interview_contacts (contact_id, application_id);

alter table public.interview_contacts enable row level security;

revoke all on table public.interview_contacts from anon, authenticated;
grant select, delete on table public.interview_contacts to authenticated;
grant insert (application_id, interview_id, contact_id) on table public.interview_contacts to authenticated;

create policy interview_contacts_select_own on public.interview_contacts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy interview_contacts_insert_own on public.interview_contacts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy interview_contacts_delete_own on public.interview_contacts
  for delete to authenticated
  using (user_id = (select auth.uid()));

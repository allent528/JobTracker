-- interview_contacts (F7): which of the application's contacts were interviewers in a round.
-- Rows are immutable: add or remove them, never update.
create table public.interview_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null references public.interviews (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint interview_contacts_unique unique (interview_id, contact_id)
);

create index interview_contacts_user_id_idx on public.interview_contacts (user_id);
create index interview_contacts_contact_id_idx on public.interview_contacts (contact_id);

alter table public.interview_contacts enable row level security;

revoke all on table public.interview_contacts from anon, authenticated;
grant select, insert, delete on table public.interview_contacts to authenticated;

create policy interview_contacts_select_own on public.interview_contacts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The interview and the contact must both be the user's and belong to the same application.
create policy interview_contacts_insert_own on public.interview_contacts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.interviews i
      join public.contacts c on c.application_id = i.application_id
      where i.id = interview_id
        and c.id = contact_id
        and i.user_id = (select auth.uid())
        and c.user_id = (select auth.uid())
    )
  );

create policy interview_contacts_delete_own on public.interview_contacts
  for delete to authenticated
  using (user_id = (select auth.uid()));

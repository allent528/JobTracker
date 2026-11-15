-- contacts (F6): people attached to an application.
-- The (application_id, user_id) foreign key ties each contact to an application of the same user.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of interview_contacts' (contact_id, application_id) foreign key.
  constraint contacts_id_application_id_key unique (id, application_id),
  constraint contacts_application_fkey foreign key (application_id, user_id)
    references public.applications (id, user_id) on delete cascade,
  constraint contacts_name_not_blank check (btrim(name) <> ''),
  -- Only web links, so a stored URL can never become a javascript: href.
  constraint contacts_linkedin_url_http check (linkedin_url ~* '^https?://'),
  constraint contacts_name_length check (char_length(name) <= 200),
  constraint contacts_title_length check (char_length(title) <= 200),
  constraint contacts_email_length check (char_length(email) <= 320),
  constraint contacts_phone_length check (char_length(phone) <= 200),
  constraint contacts_linkedin_url_length check (char_length(linkedin_url) <= 2048),
  constraint contacts_notes_length check (char_length(notes) <= 20000)
);

create index contacts_user_id_idx on public.contacts (user_id);
create index contacts_application_id_user_id_idx on public.contacts (application_id, user_id);

alter table public.contacts enable row level security;

revoke all on table public.contacts from anon, authenticated;
grant select, delete on table public.contacts to authenticated;
grant insert (application_id, name, title, email, phone, linkedin_url, notes)
  on table public.contacts to authenticated;
grant update (name, title, email, phone, linkedin_url, notes)
  on table public.contacts to authenticated;

create policy contacts_select_own on public.contacts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy contacts_insert_own on public.contacts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy contacts_update_own on public.contacts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy contacts_delete_own on public.contacts
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function private.set_updated_at();

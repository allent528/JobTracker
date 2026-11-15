-- contacts (F6): people attached to an application.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_name_not_blank check (btrim(name) <> ''),
  -- Only web links, so a stored URL can never become a javascript: href.
  constraint contacts_linkedin_url_http check (linkedin_url ~* '^https?://')
);

create index contacts_user_id_idx on public.contacts (user_id);
create index contacts_application_id_idx on public.contacts (application_id);

alter table public.contacts enable row level security;

revoke all on table public.contacts from anon, authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;

create policy contacts_select_own on public.contacts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy contacts_insert_own on public.contacts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy contacts_update_own on public.contacts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy contacts_delete_own on public.contacts
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function private.set_updated_at();

-- notes (F5): timestamped notes on an application, plain text or Markdown.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_body_not_blank check (btrim(body) <> '')
);

create index notes_user_id_idx on public.notes (user_id);
create index notes_application_id_created_at_idx on public.notes (application_id, created_at);

alter table public.notes enable row level security;

revoke all on table public.notes from anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;

create policy notes_select_own on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notes_insert_own on public.notes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy notes_update_own on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy notes_delete_own on public.notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function private.set_updated_at();

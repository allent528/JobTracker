-- status_events (F4, D5): one row per status change, including the initial status on insert.
-- Written only by the security definer trigger below, in the same transaction as the change.
-- Clients may read their own rows; nobody but the table owner can insert, update or delete.
create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index status_events_user_id_idx on public.status_events (user_id);
create index status_events_application_id_changed_at_idx
  on public.status_events (application_id, changed_at);

alter table public.status_events enable row level security;

revoke all on table public.status_events from anon, authenticated, service_role;
grant select on table public.status_events to authenticated;

create policy status_events_select_own on public.status_events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert, update or delete policies, for anyone (D5).

-- Security definer so it can write status_events, which clients have no rights on. It copies
-- user_id from the application row, which the applications policies already tied to auth.uid().
create function private.log_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.status_events (user_id, application_id, from_status, to_status)
  values (
    new.user_id,
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status
  );
  return null;
end;
$$;

revoke execute on function private.log_status_event() from public, anon, authenticated;

create trigger applications_log_initial_status
  after insert on public.applications
  for each row execute function private.log_status_event();

create trigger applications_log_status_change
  after update of status on public.applications
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_status_event();

-- profiles: one row per auth user, holding the owner's IANA time zone (F8, D11).
-- Created by a trigger on auth.users; clients can read and change only their own time_zone.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (time_zone) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policies: the auth.users trigger inserts, and deleting the user cascades.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- A check constraint can't query a table, so validate against pg_timezone_names in a trigger.
create function private.validate_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_time_zone() from public, anon, authenticated;

create trigger profiles_validate_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function private.validate_time_zone();

-- Creates the profile for every new auth user. Security definer: it runs inside GoTrue's
-- insert into auth.users, whose role has no rights on public.profiles.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users created before this migration (e.g. the owner on prod) get a profile too.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

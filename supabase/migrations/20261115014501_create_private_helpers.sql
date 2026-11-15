-- Private schema for trigger functions. It is not in the API's exposed schemas, and clients get
-- no usage on it, so nothing here is callable over PostgREST.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

alter default privileges in schema private revoke execute on functions from public;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

-- Stats dashboard (F9, D13): security invoker functions, so RLS applies on top of each user_id filter.
-- They return raw facts; status classification lives in src/lib/status.ts and src/lib/stats.ts.

-- Applications per current status.
create function public.stats_status_counts(include_archived boolean)
returns table (status text, applications bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.status, count(*)
  from public.applications a
  where a.user_id = (select auth.uid())
    and (include_archived or a.archived_at is null)
  group by a.status;
$$;

-- Applications per date applied in the half-open window [from_day, until_day).
create function public.stats_applied_per_day(from_day date, until_day date, include_archived boolean)
returns table (day date, applications bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.date_applied, count(*)
  from public.applications a
  where a.user_id = (select auth.uid())
    and (include_archived or a.archived_at is null)
    and a.date_applied >= from_day
    and a.date_applied < until_day
  group by a.date_applied;
$$;

-- How many applications ever reached one of reached_statuses, and how many of those also ever
-- reached one of responded_statuses, going by their status history. Each list holds at most 32.
create function public.stats_response_counts(
  reached_statuses text[],
  responded_statuses text[],
  include_archived boolean
)
returns table (reached bigint, responded bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if cardinality(reached_statuses) > 32 or cardinality(responded_statuses) > 32 then
    raise exception 'too_many_statuses' using errcode = '22023';
  end if;

  return query
  with per_application as (
    select
      bool_or(e.to_status = any (reached_statuses)) as has_reached,
      bool_or(e.to_status = any (responded_statuses)) as has_responded
    from public.status_events e
    join public.applications a on a.id = e.application_id and a.user_id = e.user_id
    where e.user_id = (select auth.uid())
      and (include_archived or a.archived_at is null)
    group by e.application_id
  )
  select
    count(*) filter (where p.has_reached),
    count(*) filter (where p.has_reached and p.has_responded)
  from per_application p;
end;
$$;

-- Completed stays per status: a stay starts at a status event and ends at the application's next
-- event (ordered by changed_at, id as a tie-break). The current status has no end yet, so it
-- doesn't count. average_days is elapsed time in days (86400 seconds).
create function public.stats_stage_durations(include_archived boolean)
returns table (status text, stays bigint, average_days double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with stays as (
    select
      e.to_status,
      e.changed_at,
      lead(e.changed_at) over (partition by e.application_id order by e.changed_at, e.id) as left_at
    from public.status_events e
    join public.applications a on a.id = e.application_id and a.user_id = e.user_id
    where e.user_id = (select auth.uid())
      and (include_archived or a.archived_at is null)
  )
  select
    s.to_status,
    count(*),
    (avg(extract(epoch from s.left_at - s.changed_at)) / 86400)::double precision
  from stays s
  where s.left_at is not null
  group by s.to_status;
$$;

-- Signed-in users only: no anon, and no service_role (nothing in v1 needs it).
revoke execute on function public.stats_status_counts(boolean) from public, anon, service_role;
revoke execute on function public.stats_applied_per_day(date, date, boolean) from public, anon, service_role;
revoke execute on function public.stats_response_counts(text[], text[], boolean) from public, anon, service_role;
revoke execute on function public.stats_stage_durations(boolean) from public, anon, service_role;

grant execute on function public.stats_status_counts(boolean) to authenticated;
grant execute on function public.stats_applied_per_day(date, date, boolean) to authenticated;
grant execute on function public.stats_response_counts(text[], text[], boolean) to authenticated;
grant execute on function public.stats_stage_durations(boolean) to authenticated;

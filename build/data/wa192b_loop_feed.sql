-- wave192b (01/10/26): what the page reads instead of session rows. Shared notes and who is in, never a time or hours.
-- Applied before the page (wave192) ships; wa192c then limits session rows to the person, admins and HR.

-- the notes people shared (to a team, to everyone or to the Hub): the day only, the lines, the closed tasks that are open to all
create or replace function public.loop_feed(p_days int default 7, p_email text default null)
returns table (id bigint, email text, name text, department text, day date, bullets jsonb, closed int, closed_titles jsonb, share_to text)
language sql
stable
security definer
set search_path to ''
as $$
  select c.id, lower(c.email), c.name, c.department,
         (c.ended_at at time zone 'America/Toronto')::date,
         c.summary -> 'bullets',
         coalesce(array_length(c.closed_task_ids, 1), 0),
         coalesce((select jsonb_agg(t.title order by t.id) from public.dept_tasks t
                    where t.id = any(c.closed_task_ids)
                      and not coalesce(t.confidential, false) and not coalesce(t.board_only, false)
                      and (t.visibility is null or t.visibility = 'department')), '[]'::jsonb),
         c.share_to
    from public.hub_checkins c
   where (public.is_wa_staff() or public.is_hub_admin())
     and c.ended_at is not null
     and c.summary is not null and jsonb_typeof(c.summary -> 'bullets') = 'array' and jsonb_array_length(c.summary -> 'bullets') > 0
     and c.ended_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
     and (p_email is null or lower(c.email) = lower(trim(p_email)))
   order by c.ended_at desc
   limit 80
$$;
comment on function public.loop_feed(int, text) is 'wave192b: the Loop notes people shared (Home''s In the loop, the person page''s Their loop): who, their team, the day (Toronto), the lines, how many tasks were closed and the titles of the closed tasks that are open to everyone (confidential, board-only and restricted ones are counted, never named). No clock time, no minutes. Staff and admins; p_days 1 to 90, optional p_email for one person.';
revoke all on function public.loop_feed(int, text) from public, anon;
grant execute on function public.loop_feed(int, text) to authenticated, service_role;

-- who is in right now (the ring on their photo): emails only
create or replace function public.loop_in_now()
returns table (email text)
language sql
stable
security definer
set search_path to ''
as $$
  select distinct lower(c.email)
    from public.hub_checkins c
   where (public.is_wa_staff() or public.is_hub_admin() or public.is_board_viewer())
     and c.ended_at is null and c.started_at > now() - interval '14 hours'
$$;
comment on function public.loop_in_now() is 'wave192b: the emails of the people in a Loop session now (started in the last 14 hours, not closed), for the ring on their photo in the header (wave116j). No times. Staff, admins and board viewers.';
revoke all on function public.loop_in_now() from public, anon;
grant execute on function public.loop_in_now() to authenticated, service_role;

-- wave290b: assertions on the live database, after build/data/wa290_home_servings.sql and build/data/wa290b_next_and_shoutouts.sql. Runs only
-- inside the block build/sql_rollback_test.py prints, so everything rolls back: the invented member, the invented completed servings, their roster
-- rows, the Requests and the shout-outs. No transaction control. Raises on the first failure with the check's name and counts only. Invented rows
-- only (Test W290b, test.w290b.member@welfareavenue.com, servings titled Test W290b). Requests go out through pg_net, which only sends after a commit.

do $live$
declare r jsonb; r2 jsonb; x record; n int; v_today date; v_from date; v_fy int; v_next bigint; v_tm bigint; v_pid bigint; v_ev bigint[] := '{}'; i int; v_id bigint;
  v_email text := 'test.w290b.member@welfareavenue.com';
begin
  v_today := (now() at time zone 'America/Toronto')::date;
  v_from := make_date(extract(year from v_today)::int - case when extract(month from v_today) >= 10 then 0 else 1 end, 10, 1);
  v_fy := extract(year from v_from)::int + 1;

  -- 1. the objects
  if not has_function_privilege('authenticated', 'public.wa290_next_serving()', 'execute') or has_function_privilege('anon', 'public.wa290_next_serving()', 'execute') then raise exception 'w290blive 1: wa290_next_serving grants'; end if;
  if has_function_privilege('authenticated', 'public.wa290_servings_shoutouts()', 'execute') or has_function_privilege('anon', 'public.wa290_servings_shoutouts()', 'execute') then raise exception 'w290blive 1: wa290_servings_shoutouts is not service role only'; end if;
  if obj_description('public.wa290_next_serving()'::regprocedure, 'pg_proc') is null or obj_description('public.wa290_servings_shoutouts()'::regprocedure, 'pg_proc') is null then raise exception 'w290blive 1: a function has no comment'; end if;
  if (select count(*) from cron.job where jobname = 'wa-servings-shoutouts' and schedule = '25 11 * * *' and command = 'select public.wa290_servings_shoutouts()') <> 1 then raise exception 'w290blive 1: the cron job is not there once'; end if;

  -- 2. signed out: refused
  perform set_config('request.jwt.claims', '', true);
  begin r := public.wa290_next_serving(); raise exception 'w290blive 2: signed out was not refused'; exception when others then if sqlerrm not like 'Team members only%' then raise; end if; end;

  -- 3. an invented Montreal member (not Operations): the friendly card's facts
  insert into public.team_members (name, email, department, role, active) values ('Test W290b Member', v_email, 'marketing', 'Test member', true) returning id into v_tm;
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_email)::text, true);
  r := public.wa290_next_serving();
  select ev.id into v_next from public.volunteer_events ev where ev.kind = 'service' and ev.event_date >= v_today and coalesce(ev.status, '') <> 'cancelled' and coalesce(ev.location, '') not ilike '%toronto%' order by ev.event_date, ev.id limit 1;
  if (r->>'ops')::boolean then raise exception 'w290blive 3: a marketing member is counted as Operations'; end if;
  if v_next is null then
    if r->'event' <> 'null'::jsonb then raise exception 'w290blive 3: no serving ahead, but an event came back'; end if;
  else
    if (r#>>'{event,id}')::bigint <> v_next then raise exception 'w290blive 3: not the same serving as the Next serving card'; end if;
    if (r#>>'{spots,open}')::int > (r#>>'{spots,total}')::int or (r#>>'{spots,total}')::int <= 0 then raise exception 'w290blive 3: spots open % of %', r#>>'{spots,open}', r#>>'{spots,total}'; end if;
    select coalesce(sum((j->>'open')::int), 0) into n from jsonb_array_elements(r#>'{spots,roles}') j;
    if n <> (r#>>'{spots,open}')::int then raise exception 'w290blive 3: the open roles add up to %, not %', n, r#>>'{spots,open}'; end if;
    if exists (select 1 from jsonb_array_elements(r#>'{spots,roles}') j where (j->>'open')::int <= 0 or coalesce(j->>'label', '') = '') then raise exception 'w290blive 3: a role with no spot open or no label is listed'; end if;
    if (r->>'mine')::boolean then raise exception 'w290blive 3: the new member is said to be on it'; end if;
    -- signing up from the pop-up (the same sign-up as the servings card): on it, one more confirmed
    r2 := public.wa290_home_signup(array[v_next], 'server');
    if r2->>'ok' <> 'true' then raise exception 'w290blive 3: the sign-up did not say ok'; end if;
    r2 := public.wa290_next_serving();
    if not (r2->>'mine')::boolean or (r2->>'confirmed')::int <> (r->>'confirmed')::int + 1 then raise exception 'w290blive 3: after signing up: mine %, confirmed % (was %)', r2->>'mine', r2->>'confirmed', r->>'confirmed'; end if;
    if (r2#>>'{spots,open}')::int not in ((r#>>'{spots,open}')::int, (r#>>'{spots,open}')::int - 1) then raise exception 'w290blive 3: open spots went from % to %', r#>>'{spots,open}', r2#>>'{spots,open}'; end if;
  end if;
  -- Operations Montreal keep their view
  update public.team_members set department = 'opsmtl' where id = v_tm;
  r := public.wa290_next_serving();
  if not (r->>'ops')::boolean then raise exception 'w290blive 3: Operations Montreal is not counted as Operations'; end if;
  update public.team_members set department = 'marketing' where id = v_tm;
  perform set_config('request.jwt.claims', '', true);

  -- 4. the shout-out: three served is not enough, four is, once
  select vp.id into v_pid from public.volunteer_people vp where exists (select 1 from unnest(vp.emails) y where lower(btrim(y)) = v_email) order by vp.id limit 1;
  if v_pid is null then
    insert into public.volunteer_people (full_name, emails, phones, roles, tags, organization, joined_note) values ('Test W290b Member', array[v_email], '{}'::text[], array['server'], array['team member'], 'Welfare Avenue', 'Test W290b') returning id into v_pid;
  end if;
  for i in 1 .. 4 loop
    insert into public.volunteer_events (event_date, status, kind, title, location) values (v_from + i, 'completed', 'service', 'Test W290b serving ' || i, 'Test W290b') returning id into v_id;
    v_ev := v_ev || v_id;
  end loop;
  for i in 1 .. 3 loop
    insert into public.event_roster (event_id, person_id, person_name, role, status) values (v_ev[i], v_pid, 'Test W290b Member', 'server', 'Confirmed');
  end loop;
  -- a fourth row that does not count: Unavailable
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (v_ev[4], v_pid, 'Test W290b Member', 'server', 'Unavailable');
  perform public.wa290_servings_shoutouts();
  if exists (select 1 from public.hub_shoutouts s where s.ref = 'servings:' || v_fy || ':' || v_tm) then raise exception 'w290blive 4: a shout-out at three servings'; end if;
  update public.event_roster set status = 'Confirmed' where event_id = v_ev[4] and person_id = v_pid;
  perform public.wa290_servings_shoutouts();
  select * into x from public.hub_shoutouts s where s.ref = 'servings:' || v_fy || ':' || v_tm;
  if not found then raise exception 'w290blive 4: no shout-out at four servings'; end if;
  if x.kind <> 'auto' or x.source <> 'servings' or x.member_id <> v_tm or x.team <> 'marketing' or not x.active or x.by <> 'the hub'
     or x.text <> 'Test has volunteered at four servings this year. Thank you for showing up for our community!'
     or x.expires_at < now() + interval '9 days 23 hours' or x.expires_at > now() + interval '10 days 1 minute' then raise exception 'w290blive 4: the shout-out is not as expected'; end if;
  n := public.wa290_servings_shoutouts();
  if (select count(*) from public.hub_shoutouts s where s.ref = 'servings:' || v_fy || ':' || v_tm) <> 1 then raise exception 'w290blive 4: a second shout-out for the same member and year'; end if;
  -- a former member gets none
  update public.team_members set active = false where id = v_tm;
  update public.hub_shoutouts set ref = ref || ':moved' where ref = 'servings:' || v_fy || ':' || v_tm;   -- out of the way (no plain delete in a runner)
  perform public.wa290_servings_shoutouts();
  if exists (select 1 from public.hub_shoutouts s where s.ref = 'servings:' || v_fy || ':' || v_tm) then raise exception 'w290blive 4: a shout-out for a former member'; end if;

  raise notice 'w290blive: every check passed';
end $live$;

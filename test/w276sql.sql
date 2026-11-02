-- Welfare Avenue Hub: wave276 (Task 1). Assertions for build/wa276_avail.sql (team availability).
-- Assumes the migration is already loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises.
-- Offline: node test/w276sql.mjs (PGlite, with test/w276schema.sql). On live, only at the release gate and only with Steel's yes.
-- Fixtures: Sam (member of opsmtl), Ruth (leader of opsmtl on the Hub), a second leader, a manager by the org chart, another active member,
-- an inactive member and an outsider. Only Sam and Ruth use the names the plan gives; everyone else is example.invalid.

begin;

-- ---------------------------------------------------------------- fixtures
insert into public.team_members (name, email, department, active) values
  ('Sam Lee', 'sam.lee@welfareavenue.com', 'opsmtl', true),
  ('Test Other', 'w276.other@example.invalid', 'opsmtl', true),
  ('Test Gone', 'w276.gone@example.invalid', 'opsmtl', false),
  ('Test Boss', 'w276.boss@example.invalid', 'w276exec', true),
  ('Test Outsider', 'w276.out@example.invalid', 'w276else', true);
insert into public.hub_roles (email, role, profile) values
  ('ruth.owen@welfareavenue.com', 'leader', 'opsmtl'),
  ('w276.lead2@example.invalid', 'leader', 'opsmtl'),
  ('w276.boss@example.invalid', 'member', null),
  ('w276.other@example.invalid', 'member', null),
  ('w276.out@example.invalid', 'member', null);
-- the org chart: Sam's seat reports to the boss's seat
insert into public.org_positions (member_id, title, department)
  select id, 'Test Director', 'w276exec' from public.team_members where email = 'w276.boss@example.invalid';
insert into public.org_positions (member_id, title, department, reports_to)
  select m.id, 'Test Coordinator', 'opsmtl', (select id from public.org_positions where title = 'Test Director' and department = 'w276exec')
    from public.team_members m where m.email = 'sam.lee@welfareavenue.com';

-- ---------------------------------------------------------------- objects, comments, access
do $$
declare f text;
begin
  assert (select relrowsecurity from pg_class where oid = 'public.hub_team_avail'::regclass), 'hub_team_avail has row security';
  assert (select relrowsecurity from pg_class where oid = 'public.hub_team_avail_ask'::regclass), 'hub_team_avail_ask has row security';
  assert obj_description('public.hub_team_avail'::regclass, 'pg_class') is not null, 'hub_team_avail has a comment';
  assert obj_description('public.hub_team_avail_ask'::regclass, 'pg_class') is not null, 'hub_team_avail_ask has a comment';
  assert not exists (select 1 from pg_attribute a where a.attrelid in ('public.hub_team_avail'::regclass, 'public.hub_team_avail_ask'::regclass)
                      and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null), 'every column has a comment';
  assert not exists (select 1 from pg_policy p where p.polrelid in ('public.hub_team_avail'::regclass, 'public.hub_team_avail_ask'::regclass)
                      and obj_description(p.oid, 'pg_policy') is null), 'every policy has a comment';
  assert not has_table_privilege('anon', 'public.hub_team_avail', 'select'), 'anon cannot read grids';
  assert not has_table_privilege('anon', 'public.hub_team_avail_ask', 'select'), 'anon cannot read asks';
  assert not has_table_privilege('authenticated', 'public.hub_team_avail_ask', 'insert'), 'asks are written only through the RPC';
  assert not has_table_privilege('authenticated', 'public.hub_team_avail', 'delete'), 'grids are never deleted from the browser';
  assert not has_table_privilege('authenticated', 'public.hub_team_avail', 'insert'), 'grids are not inserted from the browser';
  assert not has_table_privilege('authenticated', 'public.hub_team_avail', 'update'), 'grids are not updated from the browser';
  assert has_table_privilege('authenticated', 'public.hub_team_avail', 'select'), 'grids are read from the browser';
  assert not exists (select 1 from pg_policy where polrelid = 'public.hub_team_avail'::regclass and polcmd <> 'r'), 'only read policies on grids';
  foreach f in array array['wa_avail_can_see(text)', 'wa_avail_can_manage(text)', 'wa_avail_due()', 'wa_avail_mine(text)',
      'wa_avail_save(text,date,smallint[])', 'wa_avail_snooze(text)', 'wa_avail_team(text)', 'wa_avail_ask_set(text,date,text)'] loop
    assert obj_description(('public.' || f)::regprocedure, 'pg_proc') is not null, f || ' has a comment';
    assert not has_function_privilege('anon', 'public.' || f, 'execute'), f || ' is closed to anon';
    assert has_function_privilege('authenticated', 'public.' || f, 'execute'), f || ' is open to the signed-in';
    assert (select prosecdef from pg_proc where oid = ('public.' || f)::regprocedure), f || ' is security definer';
    assert (select proconfig::text from pg_proc where oid = ('public.' || f)::regprocedure) = '{"search_path=\"\""}', f || ' has an empty search_path';
  end loop;
  assert obj_description('public.wa_avail_manager_of(text,text)'::regprocedure, 'pg_proc') is not null, 'wa_avail_manager_of has a comment';
  assert not has_function_privilege('anon', 'public.wa_avail_manager_of(text,text)', 'execute'), 'wa_avail_manager_of is closed to anon';
  assert not has_function_privilege('authenticated', 'public.wa_avail_manager_of(text,text)', 'execute'), 'wa_avail_manager_of is closed to the browser';
  assert has_function_privilege('service_role', 'public.wa_avail_manager_of(text,text)', 'execute'), 'the service key may call wa_avail_manager_of';
end $$;

-- ---------------------------------------------------------------- seeds
do $$
begin
  assert (select count(*) from public.app_config where key in ('avail_min_hours', 'avail_grid_start', 'avail_grid_end', 'avail_cell_min')) = 4, '4 app_config keys';
  assert (select value from public.app_config where key = 'avail_min_hours') = '10', 'min hours is 10';
  assert (select value from public.app_config where key = 'avail_grid_start') = '480', 'grid starts at 08:00';
  assert (select value from public.app_config where key = 'avail_grid_end') = '1320', 'grid ends at 22:00';
  assert (select value from public.app_config where key = 'avail_cell_min') = '30', 'cells are 30 minutes';
  assert not exists (select 1 from public.dept_meta d
                      where (select count(*) from public.hub_team_avail_ask a where a.department = d.department and a.set_by = 'wave276') <> 4), '4 seeded asks per team code';
  assert (select array_agg(distinct ask_date::text order by ask_date::text) from public.hub_team_avail_ask where set_by = 'wave276')
         = array['2026-11-02', '2027-01-04', '2027-05-03', '2027-09-06'], 'the four ask dates';
  assert (select count(*) from public.hub_notification_kinds where key in ('meet_propose', 'meet_avail_ask')
            and grp = 'people' and hub and slack and not email and active) = 2, '2 kinds, Hub and Slack, no email';
  assert (select title from public.hub_notification_kinds where key = 'meet_propose') = 'A leader proposed a new meeting time for my team', 'meet_propose title';
  assert (select title from public.hub_notification_kinds where key = 'meet_avail_ask') = 'My team needs my availability', 'meet_avail_ask title';
  assert (select sort from public.hub_notification_kinds where key = 'meet_propose') = 60, 'meet_propose sorts 60';
  assert (select sort from public.hub_notification_kinds where key = 'meet_avail_ask') = 61, 'meet_avail_ask sorts 61';
  assert not exists (select 1 from public.hub_notification_kinds where key in ('meet_propose', 'meet_avail_ask')
                      and (row_to_json(hub_notification_kinds)::text ~ chr(8212) or row_to_json(hub_notification_kinds)::text ~ '\mAI\M')), 'no em dash, no "AI"';
end $$;

-- ---------------------------------------------------------------- Sam: due, save, mine
select set_config('request.jwt.claims', '{"role":"authenticated","email":"sam.lee@welfareavenue.com"}', true);
insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('opsmtl', current_date, 'w276test');

do $$
begin
  assert public.wa180_my_teams() = array['opsmtl'], 'Sam is on opsmtl only';
  assert (select array_agg(department) from public.wa_avail_due()) = array['opsmtl'], 'no rows and an ask today: opsmtl is due';
  assert (select ask_date from public.wa_avail_due()) = current_date, 'due says the ask date';
  assert (select last_saved from public.wa_avail_due()) is null, 'due says never saved';
  assert public.wa_avail_mine('opsmtl') is null, 'no grid yet';
end $$;

-- Review Focus 1: a team with no ask row at all is still due when the member has no row
delete from public.hub_team_avail_ask where department = 'opsmtl';
do $$
begin
  assert (select array_agg(department) from public.wa_avail_due()) = array['opsmtl'], 'no ask row and no grid: still due';
  assert (select ask_date from public.wa_avail_due()) is null, 'with no ask date';
end $$;
insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('opsmtl', current_date, 'w276test');

do $$
declare j jsonb;
begin
  j := public.wa_avail_save('opsmtl', current_date, array[1020, 1050, 1080, 1110]::smallint[]);
  assert (j->>'hours')::numeric = 2, '4 cells of 30 minutes are 2 hours (' || j::text || ')';
  assert (j->>'min_hours')::numeric = 10, 'min_hours is 10';
  assert (j->>'id') is not null, 'save returns the row id';
  assert not exists (select 1 from public.wa_avail_due()), 'saved: nothing is due';
  assert (select email from public.hub_team_avail where id = (j->>'id')::bigint) = 'sam.lee@welfareavenue.com', 'the row is Sam''s';

  -- 20 cells, same date: the same row is updated
  j := public.wa_avail_save('opsmtl', current_date, (select array_agg(s)::smallint[] from generate_series(0, 19) g, lateral (select 1020 + 30 * g) x(s)));
  assert public.wa_avail_mine('opsmtl')->>'hours' = '10', '20 cells are 10 hours (' || (public.wa_avail_mine('opsmtl'))::text || ')';
  assert (select count(*) from public.hub_team_avail where email = 'sam.lee@welfareavenue.com') = 1, 'still one row';
  assert jsonb_array_length(public.wa_avail_mine('opsmtl')->'slots') = 20, 'mine has the 20 slots';

  -- Review Focus 3: a grid for later does not replace today's
  perform public.wa_avail_save('opsmtl', current_date + 30, array[2460]::smallint[]);
  assert (public.wa_avail_mine('opsmtl')->>'effective_from')::date = current_date, 'mine is still today''s grid';
  assert public.wa_avail_mine('opsmtl')->>'hours' = '10', 'with its 10 hours';
  assert not exists (select 1 from public.wa_avail_due()), 'a future grid does not make the team due';

  -- not your team
  begin
    perform public.wa_avail_save('hr', current_date, array[1020]::smallint[]);
    raise exception 'save for a team Sam is not on went through';
  exception when others then
    if sqlerrm like 'save for a team%' then raise; end if;
  end;
  begin
    perform public.wa_avail_save('opsmtl', current_date, array[99999]::smallint[]);
    raise exception 'a slot outside the week was saved';
  exception when others then
    if sqlerrm like 'a slot outside%' then raise; end if;
  end;
end $$;

-- snooze: make Sam due again (his last save is older than the ask), then snooze, then let the snooze run out
update public.hub_team_avail set updated_at = now() - interval '10 days' where email = 'sam.lee@welfareavenue.com';
do $$
begin
  assert (select array_agg(department) from public.wa_avail_due()) = array['opsmtl'], 'an ask newer than the last save: due';
  perform public.wa_avail_snooze('opsmtl');
  assert not exists (select 1 from public.wa_avail_due()), 'snoozed: not due';
  assert (public.wa_avail_mine('opsmtl')->>'effective_from')::date = current_date, 'snooze changes no grid';
  assert (select count(*) from public.hub_team_avail where email = 'sam.lee@welfareavenue.com' and snoozed_until > now() + interval '71 hours') = 1, 'snoozed for 3 days on one row';
  assert (select count(*) from public.hub_team_avail where email = 'sam.lee@welfareavenue.com' and updated_at > now() - interval '1 day') = 0, 'a snooze is not a save';
end $$;
update public.hub_team_avail set snoozed_until = now() - interval '1 day' where email = 'sam.lee@welfareavenue.com';
insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('opsmtl', current_date - 1, 'w276test');
do $$
begin
  assert (select array_agg(department) from public.wa_avail_due()) = array['opsmtl'], 'snooze over and a newer ask: due again';
  assert (select ask_date from public.wa_avail_due()) = current_date, 'the latest ask on or before today';
end $$;
-- Sam saves again so the team view below has him
select public.wa_avail_save('opsmtl', current_date, (select array_agg(s)::smallint[] from generate_series(0, 19) g, lateral (select 1020 + 30 * g) x(s)));

-- the other member snoozes without ever saving: a row with no slots, still due once the snooze is over, still missing for the team
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w276.other@example.invalid"}', true);
do $$
begin
  assert (select array_agg(department) from public.wa_avail_due()) = array['opsmtl'], 'the other member is due';
  perform public.wa_avail_snooze('opsmtl');
  assert not exists (select 1 from public.wa_avail_due()), 'snoozed with no grid: not due';
  assert (select count(*) from public.hub_team_avail where email = 'w276.other@example.invalid' and slots = '{}' and updated_at is null) = 1, 'an empty row that is not a save';
  assert public.wa_avail_mine('opsmtl') is null, 'mine never returns a row that only holds Ask me later (' || coalesce(public.wa_avail_mine('opsmtl')::text, 'null') || ')';
  update public.hub_team_avail set snoozed_until = now() - interval '1 minute' where email = 'w276.other@example.invalid';
  assert (select array_agg(department) from public.wa_avail_due()) = array['opsmtl'], 'snooze over, never saved: due again';
  begin
    perform public.wa_avail_snooze('hr');
    raise exception 'snooze for a team the member is not on went through';
  exception when others then
    if sqlerrm like 'snooze for a team%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------- who manages
select set_config('request.jwt.claims', '{"role":"authenticated","email":"ruth.owen@welfareavenue.com"}', true);
do $$
begin
  assert public.wa_avail_can_manage('opsmtl'), 'Ruth (leader, profile opsmtl) manages opsmtl';
  assert not public.wa_avail_can_manage('hr'), 'Ruth does not manage hr';
  assert public.wa_avail_can_see('opsmtl'), 'Ruth sees opsmtl';
  assert not public.wa_avail_can_see('hr'), 'Ruth does not see hr';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w276.lead2@example.invalid"}', true);
do $$ begin assert public.wa_avail_can_manage('opsmtl'), 'a second leader on the team also manages it'; end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w276.boss@example.invalid"}', true);
do $$
begin
  assert public.wa_avail_can_manage('opsmtl'), 'the person Sam''s seat reports to manages opsmtl, with no leader role';
  assert public.wa_avail_can_see('opsmtl'), 'and sees it';
  assert not public.wa_avail_can_manage('hr'), 'but not hr';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"sam.lee@welfareavenue.com"}', true);
do $$
begin
  assert not public.wa_avail_can_manage('opsmtl'), 'Sam does not manage his own team';
  assert public.wa_avail_can_see('opsmtl'), 'Sam sees his team';
end $$;

-- ---------------------------------------------------------------- the team view
-- three weekly meetings for Sam on Tuesday 17:00 Toronto (one clash), a cancelled weekly one and a two-week one (no clash)
insert into public.hub_events (id, summary, attendee_emails, status, start_at, end_at)
select 'w276ev' || k, 'Test weekly', array['sam.lee@welfareavenue.com'], 'confirmed',
       ((d + 7 * k) + time '17:00') at time zone 'America/Toronto', ((d + 7 * k) + time '17:30') at time zone 'America/Toronto'
  from (select t + ((2 - extract(isodow from t)::int + 7) % 7) as d from (select (now() at time zone 'America/Toronto')::date as t) x) y, generate_series(0, 2) k;
insert into public.hub_events (id, summary, attendee_emails, status, start_at, end_at)
select 'w276cx' || k, 'Test cancelled', array['sam.lee@welfareavenue.com'], 'cancelled',
       ((d + 7 * k) + time '10:00') at time zone 'America/Toronto', ((d + 7 * k) + time '10:30') at time zone 'America/Toronto'
  from (select t + ((3 - extract(isodow from t)::int + 7) % 7) as d from (select (now() at time zone 'America/Toronto')::date as t) x) y, generate_series(0, 3) k;
insert into public.hub_events (id, summary, attendee_emails, status, start_at, end_at)
select 'w276tw' || k, 'Test twice', array['sam.lee@welfareavenue.com'], 'confirmed',
       ((d + 7 * k) + time '12:00') at time zone 'America/Toronto', ((d + 7 * k) + time '12:30') at time zone 'America/Toronto'
  from (select t + ((4 - extract(isodow from t)::int + 7) % 7) as d from (select (now() at time zone 'America/Toronto')::date as t) x) y, generate_series(0, 1) k;

do $$
declare j jsonb;
begin
  j := public.wa_avail_team('opsmtl');
  assert (j->>'can_manage')::boolean = false, 'Sam cannot manage';
  assert (j->>'cell_min')::int = 30 and (j->>'start')::int = 480 and (j->>'end')::int = 1320 and (j->>'min_hours')::numeric = 10, 'the grid settings';
  assert (j->>'ask_date')::date = current_date, 'the latest ask';
  assert jsonb_array_length(j->'members') = 1 and j->'members'->0->>'email' = 'sam.lee@welfareavenue.com', 'members has Sam only (' || (j->'members')::text || ')';
  assert j->'members'->0->>'name' = 'Sam Lee' and j->'members'->0->>'hours' = '10' and jsonb_array_length(j->'members'->0->'slots') = 20, 'with his name, hours and slots';
  assert jsonb_array_length(j->'missing') = 1 and j->'missing'->0->>'email' = 'w276.other@example.invalid', 'missing has the other active member only (' || (j->'missing')::text || ')';
  assert j->'clashes' = jsonb_build_array(jsonb_build_object('email', 'sam.lee@welfareavenue.com', 'slot', 1 * 1440 + 1020)), 'one clash, Tuesday 17:00 (' || (j->'clashes')::text || ')';
  begin
    perform public.wa_avail_team('hr');
    raise exception 'Sam read the hr team';
  exception when others then
    if sqlerrm like 'Sam read%' then raise; end if;
  end;
  begin
    perform public.wa_avail_ask_set('opsmtl', current_date + 1, 'term');
    raise exception 'Sam set an ask';
  exception when others then
    if sqlerrm like 'Sam set%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","email":"ruth.owen@welfareavenue.com"}', true);
do $$
declare j jsonb;
begin
  assert (public.wa_avail_team('opsmtl')->>'can_manage')::boolean, 'Ruth can manage in the team view';
  -- an ask today: Sam saved today, so only the member who never saved is missing
  j := public.wa_avail_ask_set('opsmtl', current_date, null);
  assert (j->>'ask_date')::date = current_date, 'the ask date comes back (today)';
  assert j->'missing' = '["w276.other@example.invalid"]'::jsonb, 'missing lists the member with no grid (' || (j->'missing')::text || ')';
  -- Sam's grid goes stale (saved 10 days ago), and an ask for tomorrow: the ask just set counts, so Sam is missing too
  update public.hub_team_avail set updated_at = now() - interval '10 days' where email = 'sam.lee@welfareavenue.com';
  j := public.wa_avail_ask_set('opsmtl', current_date + 1, 'term');
  assert (j->>'ask_date')::date = current_date + 1, 'the ask date comes back';
  assert j->'missing' = '["sam.lee@welfareavenue.com", "w276.other@example.invalid"]'::jsonb, 'missing has the stale grid and the member with none (' || (j->'missing')::text || ')';
  assert (select count(*) from public.hub_team_avail_ask where department = 'opsmtl' and ask_date = current_date + 1 and note = 'term' and set_by = 'ruth.owen@welfareavenue.com') = 1, 'the ask is stored with who set it';
end $$;

-- ---------------------------------------------------------------- row security, as the browser
select set_config('request.jwt.claims', '{"role":"authenticated","email":"sam.lee@welfareavenue.com"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.hub_team_avail where department = 'opsmtl') >= 3, 'Sam reads his team''s rows';
  assert (select count(*) from public.hub_team_avail_ask) > 0, 'staff read the asks';
  begin
    insert into public.hub_team_avail (email, department) values ('w276.other@example.invalid', 'opsmtl');
    raise exception 'Sam wrote a row for someone else';
  exception when others then
    if sqlerrm like 'Sam wrote%' then raise; end if;
  end;
  begin
    insert into public.hub_team_avail_ask (department, ask_date) values ('opsmtl', current_date);
    raise exception 'Sam wrote an ask directly';
  exception when others then
    if sqlerrm like 'Sam wrote an ask%' then raise; end if;
  end;
  -- no direct writes even on his own grid: hours, dates and the save time come only from wa_avail_save
  begin
    insert into public.hub_team_avail (email, department, effective_from, slots, hours) values ('sam.lee@welfareavenue.com', 'opsmtl', current_date + 60, '{1020}', 99);
    raise exception 'Sam inserted his own row directly';
  exception when others then
    if sqlerrm like 'Sam inserted%' then raise; end if;
  end;
  begin
    update public.hub_team_avail set hours = 99 where email = 'sam.lee@welfareavenue.com';
    raise exception 'Sam updated his hours directly';
  exception when others then
    if sqlerrm like 'Sam updated%' then raise; end if;
  end;
  begin
    update public.hub_team_avail set updated_at = now() + interval '1 year', snoozed_until = now() + interval '1 year' where email = 'sam.lee@welfareavenue.com';
    raise exception 'Sam updated his save time directly';
  exception when others then
    if sqlerrm like 'Sam updated%' then raise; end if;
  end;
  assert not exists (select 1 from public.hub_team_avail where hours = 99 or updated_at > now() + interval '1 day'), 'nothing written directly';
  -- and saving through the function still works for the browser role
  assert (public.wa_avail_save('opsmtl', current_date, array[1020, 1050]::smallint[])->>'hours')::numeric = 1, 'wa_avail_save works as authenticated';
  assert public.wa_avail_mine('opsmtl')->>'hours' = '1', 'and the saved grid is the current one';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w276.out@example.invalid"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.hub_team_avail) = 0, 'someone off the team reads no grids';
end $$;
reset role;

-- ---------------------------------------------------------------- the service key
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  assert public.wa_avail_manager_of('ruth.owen@welfareavenue.com', 'opsmtl'), 'Ruth manages opsmtl (service key)';
  assert public.wa_avail_manager_of('w276.boss@example.invalid', 'opsmtl'), 'the org chart manager manages opsmtl (service key)';
  assert not public.wa_avail_manager_of('sam.lee@welfareavenue.com', 'opsmtl'), 'Sam does not';
  assert not public.wa_avail_manager_of('ruth.owen@welfareavenue.com', 'hr'), 'Ruth does not manage hr';
end $$;
reset role;

select 'w276sql: all assertions passed' as result;
rollback;

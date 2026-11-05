-- Welfare Avenue Hub: wave271 (271a), Task 1. Assertions for build/wa271a_onboard.sql.
-- Assumes the migration is already loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises.
-- Offline: node test/w271sql.mjs (PGlite, with test/w271schema.sql). On live, only at the release gate and only with Steel's yes:
-- paste this file into execute_sql once the migration has been applied; afterwards the test rows are gone.
-- Every row is invented (Test Person, example.invalid). Fixtures sit in the department code w271test so no real team is touched.

begin;

-- ---------------------------------------------------------------- fixtures
insert into public.hub_positions (title, dept) values ('Test Analyst', 'w271test'), ('Test Other', 'w271test'), ('Test Foreign', 'w271test');

insert into public.team_members (name, email, department, role) values
  ('Test Leader One', 'w271.lead1@example.invalid', 'w271test', 'Director'),
  ('Test Hire A', 'w271.hirea@example.invalid', 'w271test', 'Analyst'),
  ('Test Hire B', 'w271.hireb@example.invalid', 'w271test', 'Analyst');

insert into public.hub_roles (email, role) values
  ('w271.lead1@example.invalid', 'leader'),
  ('w271.staff@example.invalid', 'member');
insert into public.wa_hr_access (email) values ('w271.hr@example.invalid');

insert into public.org_positions (member_id, title, department, kind, status)
  select id, 'Test Director', 'w271test', 'staff', 'filled' from public.team_members where email = 'w271.lead1@example.invalid';
insert into public.org_positions (title, department, status, reports_to)
  select 'Test Analyst', 'w271test', 'hiring', id from public.org_positions where title = 'Test Director' and department = 'w271test';

insert into public.hub_candidates (name, email, status, position_id, offer_respond_by) values
  ('Test Person One', 'w271.one@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Analyst' and dept = 'w271test'), date '2026-11-10');
insert into public.hub_candidates (name, email, status, position_id, practice) values
  ('Test Person Practice', 'w271.practice@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Other' and dept = 'w271test'), true);
insert into public.hub_candidates (name, email, status, position_id) values
  ('Test Person Twin Early', 'w271.twin@example.invalid', 'reviewing', (select id from public.hub_positions where title = 'Test Other' and dept = 'w271test')),
  ('Test Person Twin Late', 'w271.twin@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Analyst' and dept = 'w271test'));
insert into public.org_positions (title, department, status, reports_to)
  select 'Test Foreign', 'w271elsewhere', 'hiring', id from public.org_positions where title = 'Test Director' and department = 'w271test';   -- same title, another department: must not match
insert into public.hub_candidates (name, email, status) values ('Test Person No Role', 'w271.norole@example.invalid', 'offer');
insert into public.hub_candidates (name, email, status, position_id) values
  ('Test Person Foreign', 'w271.foreign@example.invalid', 'offer', (select id from public.hub_positions where title = 'Test Foreign' and dept = 'w271test'));

-- the Hub staff member who runs everything below (an HR person); the claims are read by auth.jwt() as on live
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.hr@example.invalid"}', true);

-- ---------------------------------------------------------------- the objects, comments and access rules
do $$
declare n int;
begin
  assert to_regclass('public.hub_onboard_flows') is not null and to_regclass('public.hub_onboard_grids') is not null
     and to_regclass('public.hub_onboard_steps') is not null, 'the three tables exist';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'offer_respond_by' and data_type = 'date'), 'offer_respond_by is a date';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'offer_start' and data_type = 'date'), 'offer_start is a date';

  -- COMMENT on every new table, column and function (release checklist)
  select count(*) into n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('hub_onboard_flows', 'hub_onboard_grids', 'hub_onboard_steps') and obj_description(c.oid, 'pg_class') is null;
  assert n = 0, 'every new table has a comment';
  select count(*) into n from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and c.relname in ('hub_onboard_flows', 'hub_onboard_grids', 'hub_onboard_steps') and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null;
  assert n = 0, format('%s new columns have no comment', n);
  select count(*) into n from pg_attribute a where a.attrelid = 'public.hub_candidates'::regclass and a.attname in ('offer_respond_by', 'offer_start') and col_description(a.attrelid, a.attnum) is null;
  assert n = 0, 'the two offer columns have a comment';
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'wa271\_%' or (p.proname = 'onboarding_assign')) and obj_description(p.oid, 'pg_proc') is null;
  assert n = 0, format('%s wa271 functions or onboarding_assign have no comment', n);

  -- row security on, reads for HR and admins only, nothing written from the browser
  select count(*) into n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('hub_onboard_flows', 'hub_onboard_grids', 'hub_onboard_steps') and c.relrowsecurity;
  assert n = 3, 'row security is on for all three tables';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'update')
     and not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'delete'), 'no direct writes to flows';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_grids', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_grids', 'update')
     and not has_table_privilege('authenticated', 'public.hub_onboard_grids', 'delete'), 'no direct writes to grids';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_steps', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_steps', 'update')
     and not has_table_privilege('authenticated', 'public.hub_onboard_steps', 'delete'), 'no direct writes to steps';
  assert not has_table_privilege('anon', 'public.hub_onboard_flows', 'select') and not has_table_privilege('anon', 'public.hub_onboard_grids', 'select')
     and not has_table_privilege('anon', 'public.hub_onboard_steps', 'select'), 'a signed-out visitor reads nothing';
  assert not has_column_privilege('authenticated', 'public.hub_onboard_flows', 'pw_nonce', 'select'), 'the password-link nonce never reaches the browser';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'status', 'select'), 'HR can read the flow columns that are not secret';

  -- functions: signed-in people and the service key, never a signed-out visitor
  assert not has_function_privilege('anon', 'public.wa271_ready_list()', 'execute') and has_function_privilege('authenticated', 'public.wa271_ready_list()', 'execute'), 'ready list grants';
  assert not has_function_privilege('anon', 'public.wa271_default_manager(bigint)', 'execute') and has_function_privilege('authenticated', 'public.wa271_default_manager(bigint)', 'execute'), 'default manager grants';
  assert not has_function_privilege('anon', 'public.wa271_move_start(bigint, date)', 'execute') and has_function_privilege('authenticated', 'public.wa271_move_start(bigint, date)', 'execute'), 'move start grants';
  assert not has_function_privilege('anon', 'public.wa271_cand_accepted()', 'execute') and not has_function_privilege('authenticated', 'public.wa271_cand_accepted()', 'execute'), 'the trigger function is not callable';
  assert to_regprocedure('public.onboarding_assign(bigint,text)') is null, 'the 2-argument onboarding_assign is gone';
  assert to_regprocedure('public.onboarding_assign(bigint,text,date)') is not null, 'the dated onboarding_assign exists';
  assert not has_function_privilege('anon', 'public.onboarding_assign(bigint,text,date)', 'execute') and has_function_privilege('authenticated', 'public.onboarding_assign(bigint,text,date)', 'execute')
     and has_function_privilege('service_role', 'public.onboarding_assign(bigint,text,date)', 'execute'), 'onboarding_assign keeps its grants';
end $$;

-- the checks on the new tables
do $$
declare v_cand bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_ok boolean;
begin
  insert into public.hub_onboard_flows (candidate_id) values (v_cand);   -- default status
  assert (select status from public.hub_onboard_flows where candidate_id = v_cand) = 'waiting', 'a new flow waits';
  begin update public.hub_onboard_flows set status = 'nonsense' where candidate_id = v_cand; v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a flow status outside the five is refused';
  begin insert into public.hub_onboard_flows (candidate_id) values (v_cand); v_ok := false; exception when unique_violation then v_ok := true; end;
  assert v_ok, 'one flow per candidate';
  begin insert into public.hub_onboard_grids (flow_id, who) values ((select id from public.hub_onboard_flows where candidate_id = v_cand), 'boss'); v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a grid belongs to the hire or the manager';
  begin insert into public.hub_onboard_steps (flow_id, step, status) values ((select id from public.hub_onboard_flows where candidate_id = v_cand), 'nope', 'done'); v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a step key outside the eight is refused';
  begin insert into public.hub_onboard_steps (flow_id, step, status) values ((select id from public.hub_onboard_flows where candidate_id = v_cand), 'roster', 'finished'); v_ok := false; exception when check_violation then v_ok := true; end;
  assert v_ok, 'a step status outside the seven is refused';
  delete from public.hub_onboard_flows where candidate_id = v_cand;   -- the trigger tests start from a clean candidate
end $$;

-- ---------------------------------------------------------------- settings
do $$
declare n int;
begin
  select count(*) into n from public.app_config where (key, value) in (
    ('onboard_grid_days', '14'), ('onboard_grid_start', '8'), ('onboard_grid_end', '21'), ('onboard_grid_cell_min', '30'), ('onboard_call_min', '60'),
    ('onboard_one_on_one_min', '30'), ('onboard_remind_hours', '48'), ('onboard_password_days', '7'), ('onboard_auto_google', 'off'), ('onboard_auto_slack', 'off'));
  assert n = 10, format('%s of the 10 fixed onboard_ settings have their default', n);
  select count(*) into n from public.app_config where key in ('onboard_slack_join_link', 'onboard_google_video');
  assert n = 2, 'the two link settings exist';
  assert not exists (select 1 from public.app_config where key = 'onboard_canva_link'), 'no Canva link in settings: HR pastes a fresh one for each hire';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'canva_link', 'select'), 'HR can read the link on the flow';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'welcome_edited', 'select'), 'HR can read whose welcome text is saved';
  assert col_description('public.hub_onboard_flows'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_onboard_flows'::regclass and attname = 'canva_link')) like '%30 days%', 'canva_link says why it is on the flow';

  -- the onboarding call is day one
  assert (select count(*) from public.hr_setup_template where phase = 'The onboarding call') > 0, 'the onboarding call phase exists';
  assert (select count(*) from public.hr_setup_template where phase = 'The onboarding call' and due_day is distinct from 0) = 0, 'The onboarding call phase is due on day 0';
  assert (select count(*) from public.hr_setup_template where phase = 'Manager follow-through' and due_day is null) = 0, 'the other phases keep their days';
end $$;

-- ---------------------------------------------------------------- accepting an offer starts one waiting flow
do $$
declare v_cand bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_prac bigint := (select id from public.hub_candidates where name = 'Test Person Practice');
begin
  assert (select count(*) from public.hub_onboard_flows where candidate_id in (v_cand, v_prac)) = 0, 'no flow before an acceptance';
  update public.hub_candidates set status = 'offer', notes = 'edited' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 0, 'an edit that is not an acceptance starts nothing';

  update public.hub_candidates set accepted_on = date '2026-11-12' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 1, 'the acceptance creates exactly one flow';
  assert (select status from public.hub_onboard_flows where candidate_id = v_cand) = 'waiting', 'the new flow is waiting';
  assert (select practice from public.hub_onboard_flows where candidate_id = v_cand) = false, 'a real candidate is not practice';

  update public.hub_candidates set accepted_on = date '2026-11-13' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 1, 'a second update creates none';
  update public.hub_candidates set accepted_on = null where id = v_cand;
  update public.hub_candidates set accepted_on = date '2026-11-12' where id = v_cand;
  assert (select count(*) from public.hub_onboard_flows where candidate_id = v_cand) = 1, 'accepting again after a clearing still leaves one flow';

  update public.hub_candidates set accepted_on = date '2026-11-12' where id = v_prac;
  assert (select practice from public.hub_onboard_flows where candidate_id = v_prac) = true, 'a practice candidate gets a practice flow';
end $$;

-- ---------------------------------------------------------------- two rows, one person
do $$
declare v_early bigint := (select id from public.hub_candidates where name = 'Test Person Twin Early'); v_late bigint := (select id from public.hub_candidates where name = 'Test Person Twin Late');
        e jsonb;
begin
  update public.hub_candidates set accepted_on = date '2026-11-14' where id = v_late;
  assert (select count(*) from public.hub_onboard_flows where candidate_id in (v_early, v_late)) = 1, 'only one flow for the two rows';
  assert (select candidate_id from public.hub_onboard_flows where candidate_id in (v_early, v_late)) = v_late, 'the flow is on the accepted row';
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_late;
  assert e is not null, 'the accepted row is on the ready list';
  assert (e ->> 'other_open_rows')::int = 1, format('other_open_rows is 1, got %s', e ->> 'other_open_rows');
  update public.hub_candidates set status = 'withdrawn' where id = v_early;
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_late;
  assert (e ->> 'other_open_rows')::int = 0, 'a withdrawn twin no longer counts';
  update public.hub_candidates set status = 'reviewing' where id = v_early;
end $$;

-- ---------------------------------------------------------------- the ready list
do $$
declare v_one bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_late bigint := (select id from public.hub_candidates where name = 'Test Person Twin Late');
        v_prac bigint := (select id from public.hub_candidates where name = 'Test Person Practice'); e jsonb; v_flow bigint;
begin
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one;
  assert e ->> 'name' = 'Test Person One' and e ->> 'email' = 'w271.one@example.invalid', 'name and personal email are listed';
  assert e ->> 'status' = 'waiting' and (e ->> 'practice')::boolean = false, 'status and practice are listed';
  assert e ->> 'accepted_on' = '2026-11-12' and e ->> 'offer_respond_by' = '2026-11-10', 'the offer dates are listed';
  assert (e ->> 'late')::boolean = true, 'accepted after the respond-by date is late';
  assert e -> 'grids' ->> 'hire' = 'none' and e -> 'grids' ->> 'manager' = 'none', 'no grid yet';
  assert e -> 'default_manager' ->> 'how' = 'reports_to', 'the default manager comes with the row';
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_late;
  assert (e ->> 'late')::boolean = false, 'no respond-by date means not late';

  select id into v_flow from public.hub_onboard_flows where candidate_id = v_one;
  insert into public.hub_onboard_grids (flow_id, who, slots) values (v_flow, 'hire', array[timestamptz '2026-11-20 15:00+00', timestamptz '2026-11-20 15:30+00']);
  insert into public.hub_onboard_grids (flow_id, who) values (v_flow, 'manager');
  select x into e from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one;
  assert e -> 'grids' ->> 'hire' = 'marked' and e -> 'grids' ->> 'manager' = 'none', 'a grid with times is marked, an empty one is not';

  -- once started or backed out, a flow leaves the list
  update public.hub_onboard_flows set status = 'running' where candidate_id = v_one;
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a running flow stays on the list';
  update public.hub_onboard_flows set status = 'started' where candidate_id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a started flow leaves the list';
  update public.hub_onboard_flows set status = 'backed_out' where candidate_id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a backed-out flow leaves the list';
  update public.hub_onboard_flows set status = 'waiting' where candidate_id = v_one;
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_prac), 'the practice flow is listed too, marked as practice';

  -- a closed card leaves the list, and comes back if the card opens again
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'an open card is listed';
  update public.hub_candidates set status = 'withdrawn' where id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a withdrawn card leaves the list';
  update public.hub_candidates set status = 'declined' where id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a declined card leaves the list';
  update public.hub_candidates set status = 'offer' where id = v_one;

  -- someone with an open plan (the roster dropdown) leaves the list, found by the card's profile or by the personal email
  insert into public.team_members (name, email) values ('Test Person One Roster', 'W271.One@example.invalid');
  insert into public.onboardings (member_id, person_name, started_at) select id, name, current_date from public.team_members where name = 'Test Person One Roster';
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'an open plan found by the personal email takes them off the list';
  update public.onboardings set completed_at = now() where person_name = 'Test Person One Roster';
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'a finished plan does not count';
  update public.onboardings set completed_at = null where person_name = 'Test Person One Roster';
  update public.team_members set email = 'w271.other@example.invalid' where name = 'Test Person One Roster';
  assert exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'someone else''s plan does not count';
  update public.hub_candidates set member_id = (select id from public.team_members where name = 'Test Person One Roster') where id = v_one;
  assert not exists (select 1 from jsonb_array_elements(public.wa271_ready_list()) x where (x ->> 'candidate_id')::bigint = v_one), 'an open plan found by the card''s profile takes them off the list';
  update public.hub_candidates set member_id = null where id = v_one;
  delete from public.onboardings where person_name = 'Test Person One Roster';
  delete from public.team_members where name = 'Test Person One Roster';

  -- roster_created: the browser may read it, and it starts empty
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'roster_created', 'select'), 'HR can read roster_created';
  assert (select roster_created from public.hub_onboard_flows where candidate_id = v_one) is null, 'nothing is known until the roster step runs';
end $$;

-- ---------------------------------------------------------------- the default manager
do $$
declare v_one bigint := (select id from public.hub_candidates where name = 'Test Person One');          -- position Test Analyst: an org position reports to Test Leader One
        v_other bigint := (select id from public.hub_candidates where name = 'Test Person Practice');   -- position Test Other: no org position
        v_norole bigint := (select id from public.hub_candidates where name = 'Test Person No Role');
        v_foreign bigint := (select id from public.hub_candidates where name = 'Test Person Foreign');   -- an org position with this title exists, but in another department
        v_lead bigint := (select id from public.team_members where email = 'w271.lead1@example.invalid'); r jsonb;
begin
  r := public.wa271_default_manager(v_one);
  assert r ->> 'how' = 'reports_to' and (r ->> 'member_id')::bigint = v_lead and r ->> 'name' = 'Test Leader One', format('reports_to, got %s', r);

  r := public.wa271_default_manager(v_other);
  assert r ->> 'how' = 'team_lead' and (r ->> 'member_id')::bigint = v_lead, format('team_lead for exactly one leader, got %s', r);

  r := public.wa271_default_manager(v_foreign);
  assert r ->> 'how' = 'team_lead', format('an org position in another department does not match, got %s', r);

  insert into public.team_members (name, email, department, role) values ('Test Leader Two', 'w271.lead2@example.invalid', 'w271test', 'Director');
  insert into public.hub_roles (email, role) values ('w271.lead2@example.invalid', 'leader');
  r := public.wa271_default_manager(v_other);
  assert r ->> 'how' = 'none' and (r -> 'member_id') = 'null'::jsonb, format('none for two leaders, got %s', r);
  r := public.wa271_default_manager(v_one);
  assert r ->> 'how' = 'reports_to' and (r ->> 'member_id')::bigint = v_lead, 'a reporting line wins over two leaders';

  r := public.wa271_default_manager(v_norole);
  assert r ->> 'how' = 'none', 'a candidate with no position has no default';
  r := public.wa271_default_manager(-1);
  assert r ->> 'how' = 'none', 'an unknown candidate has no default';

  -- a leader who has left is not a leader of the department
  update public.team_members set active = false where email = 'w271.lead2@example.invalid';
  r := public.wa271_default_manager(v_other);
  assert r ->> 'how' = 'team_lead' and (r ->> 'member_id')::bigint = v_lead, 'an inactive leader does not count';
  -- the person at the top of the reporting line has left, and no leader is left in the department either
  update public.team_members set active = false where id = v_lead;
  r := public.wa271_default_manager(v_one);
  assert r ->> 'how' = 'none', 'a reporting line that ends at someone who left gives no default';
  update public.team_members set active = true where id = v_lead;
end $$;

-- ---------------------------------------------------------------- onboarding_assign takes a start date, and a move keeps the plan in step
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.staff@example.invalid"}', true);   -- onboarding_assign wants a staff member

do $$
declare m_a bigint := (select id from public.team_members where email = 'w271.hirea@example.invalid'); m_b bigint := (select id from public.team_members where email = 'w271.hireb@example.invalid');
        v_a bigint; v_b bigint;
begin
  v_a := public.onboarding_assign(m_a, 'x');
  assert (select started_at from public.onboardings where id = v_a) = current_date, 'two arguments still start today';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_a) > 0, 'the plan has steps';
  assert (select bool_and(s.due_date = current_date + 7) from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_a and t.section = 'WEEK 1'), 'week 1 is due 7 days after today';
  assert (select count(*) from public.hr_setup_steps where onboarding_id = v_a) > 0, 'the HR checklist is copied';

  v_b := public.onboarding_assign(m_b, 'x', date '2026-12-07');
  assert (select started_at from public.onboardings where id = v_b) = date '2026-12-07', 'a dated plan starts on that day';
  assert (select count(*) from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 1') > 0, 'there is a week 1 step';
  assert (select bool_and(s.due_date = date '2026-12-14') from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 1'), 'week 1 is due 2026-12-14';
  assert (select assigned_by from public.onboardings where id = v_b) = 'x' and (select person_name from public.onboardings where id = v_b) = 'Test Hire B', 'name and assigner are kept';
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.hr@example.invalid"}', true);

do $$
declare m_b bigint := (select id from public.team_members where email = 'w271.hireb@example.invalid'); v_b bigint := (select id from public.onboardings where member_id = m_b);
        v_cand bigint := (select id from public.hub_candidates where name = 'Test Person One'); v_done bigint; v_w2 date;
begin
  -- the candidate and the plan are tied together by the flow
  update public.hub_onboard_flows set onboarding_id = v_b where candidate_id = v_cand;
  update public.hub_candidates set start_date = date '2026-12-07' where id = v_cand;
  update public.team_members set start_date = date '2026-12-07', start_source = 'google' where id = m_b;
  -- one step is already done
  select s.id into v_done from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 1' order by s.id limit 1;
  update public.onboarding_steps set done = true, done_at = now(), done_by = 'x' where id = v_done;

  perform public.wa271_move_start(v_b, date '2026-12-14');

  assert (select started_at from public.onboardings where id = v_b) = date '2026-12-14', 'started_at moved';
  assert (select due_date from public.onboarding_steps where id = v_done) = date '2026-12-14', 'a step already done keeps its due date';
  assert (select bool_and(s.due_date = date '2026-12-21') from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id
           where s.onboarding_id = v_b and t.section = 'WEEK 1' and s.id <> v_done), 'steps not done move with the start';
  select s.due_date into v_w2 from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = v_b and t.section = 'WEEK 2' limit 1;
  assert v_w2 = date '2026-12-28', 'other sections move by the same amount';
  assert (select start_date from public.team_members where id = m_b) = date '2026-12-14', 'team_members.start_date moved';
  assert (select start_source from public.team_members where id = m_b) = 'manual', 'the moved date is marked manual so the directory sync leaves it alone';
  assert (select start_date from public.hub_candidates where id = v_cand) = date '2026-12-14', 'hub_candidates.start_date moved';
  assert (select count(*) from public.change_log where entity_type = 'onboardings' and entity_id = v_b::text and field = 'started_at' and old_value = '2026-12-07' and new_value = '2026-12-14') = 1, 'the move is logged';

  -- a plan with no flow (assigned from the roster dropdown) still moves
  perform public.wa271_move_start((select id from public.onboardings where member_id = (select id from public.team_members where email = 'w271.hirea@example.invalid')), date '2027-01-11');
  assert (select start_date from public.team_members where email = 'w271.hirea@example.invalid') = date '2027-01-11', 'a plan without a flow moves too';

  begin perform public.wa271_move_start(-1, date '2027-01-11'); assert false, 'unreachable'; exception when raise_exception then assert sqlerrm like '%not found%', 'an unknown plan is refused'; end;
  begin perform public.wa271_move_start(v_b, null); assert false, 'unreachable'; exception when raise_exception then assert sqlerrm like '%date%', 'a missing date is refused'; end;
end $$;

-- ---------------------------------------------------------------- who can read and call what
insert into public.hub_onboard_steps (flow_id, step, status, practice) select id, 'roster', 'done', practice from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Practice');

-- HR: reads all three, cannot write
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.hr@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  assert (select count(*) from public.hub_onboard_flows) >= 3, 'HR reads the flows';
  assert (select count(*) from public.hub_onboard_grids) >= 2, 'HR reads the grids';
  assert (select count(*) from public.hub_onboard_steps) >= 1, 'HR reads the steps';
  assert jsonb_array_length(public.wa271_ready_list()) >= 3, 'HR gets the ready list';
  begin perform pw_nonce from public.hub_onboard_flows; v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'HR cannot read pw_nonce';
  begin insert into public.hub_onboard_flows (candidate_id) values ((select id from public.hub_candidates where name = 'Test Person No Role')); v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'HR cannot write a flow directly';
end $$;
reset role;

-- an admin who is not in HR also reads (is_hub_admin)
insert into public.hub_roles (email, role) values ('w271.admin@example.invalid', 'admin');
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.admin@example.invalid"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.hub_onboard_flows) >= 3, 'an admin reads the flows';
  assert jsonb_array_length(public.wa271_ready_list()) >= 3, 'an admin gets the ready list';
end $$;
reset role;

-- someone signed in who is neither HR nor an admin: no rows, and the functions refuse
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w271.staff@example.invalid"}', true);
set local role authenticated;
do $$
declare v_ok boolean;
begin
  assert (select count(*) from public.hub_onboard_flows) = 0, 'a staff member who is not HR reads no flows';
  assert (select count(*) from public.hub_onboard_grids) = 0, 'a staff member who is not HR reads no grids';
  assert (select count(*) from public.hub_onboard_steps) = 0, 'a staff member who is not HR reads no steps';
  begin perform public.wa271_ready_list(); v_ok := false; exception when raise_exception then v_ok := true; end;
  assert v_ok, 'wa271_ready_list raises for a non-HR person';
  begin perform public.wa271_default_manager(1); v_ok := false; exception when raise_exception then v_ok := true; end;
  assert v_ok, 'wa271_default_manager raises for a non-HR person';
  begin perform public.wa271_move_start(1, date '2027-01-01'); v_ok := false; exception when raise_exception then v_ok := true; end;
  assert v_ok, 'wa271_move_start raises for a non-HR person';
end $$;
reset role;

-- a visitor with no sign-in at all
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_ok boolean;
begin
  begin perform count(*) from public.hub_onboard_flows; v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'a signed-out visitor cannot read the flows';
  begin perform public.wa271_ready_list(); v_ok := false; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'a signed-out visitor cannot call the ready list';
end $$;
reset role;

-- the service key (edge functions) may call them
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
begin
  assert jsonb_array_length(public.wa271_ready_list()) >= 3, 'the service key gets the ready list';
end $$;

select 'w271sql: all assertions passed' as result;
rollback;

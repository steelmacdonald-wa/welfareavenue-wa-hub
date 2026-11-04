-- Welfare Avenue Hub: wave279 (279a). Assertions for build/wa279a_rules.sql. Tasks 2 to 4 add their sections at the end, before the final select.
-- Assumes the migration is already loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises.
-- Offline: node test/w279sql.mjs (PGlite, with test/w279schema.sql). Every row is invented (Test Person, example.invalid).

begin;

-- ---------------------------------------------------------------- fixtures
insert into public.team_members (name, email, department, role) values
  ('Test Hire Plain', 'w279.plain@example.invalid', 'w279test', 'Analyst'),
  ('Test Hire Setup', 'w279.setup@example.invalid', 'w279test', 'Analyst'),
  ('Test Hire Done', 'w279.done@example.invalid', 'w279test', 'Analyst');
insert into public.hub_roles (email, role) values ('w279.staff@example.invalid', 'member');
insert into public.hub_candidates (name, start_date) values ('Test Candidate Setup', null), ('Test Candidate Done', null);

-- the ordinary template rows (t-w1, t-w2, t-d30) are already there; one of them is covered by setup
update public.onboarding_template set setup_covered = true where id = 't-w2';

select set_config('request.jwt.claims', '{"role":"authenticated","email":"w279.staff@example.invalid"}', true);

-- ---------------------------------------------------------------- Task 1: steps covered by setup, and the 90 days rule
do $$
declare
  v_plain bigint; v_setup bigint; v_done bigint; v_n int; v_flow_setup bigint; v_flow_done bigint;
begin
  -- the column
  assert (select is_nullable = 'NO' and column_default = 'false' from information_schema.columns
           where table_schema = 'public' and table_name = 'onboarding_template' and column_name = 'setup_covered'), 'setup_covered is a not null boolean default false';
  assert (select count(*) from public.onboarding_template where setup_covered) = 1, 'only the row set above is covered by setup';

  -- wa279_via_setup is a plain look-up
  assert public.wa279_via_setup(-1) = false, 'no plan, no setup';
  assert public.wa279_via_setup(null) = false, 'a null plan is not through setup';

  -- three plans through onboarding_assign; none has a flow, so each keeps the covered step
  v_plain := public.onboarding_assign((select id from public.team_members where email = 'w279.plain@example.invalid'), 'test');
  v_setup := public.onboarding_assign((select id from public.team_members where email = 'w279.setup@example.invalid'), 'test');
  v_done := public.onboarding_assign((select id from public.team_members where email = 'w279.done@example.invalid'), 'test');
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_plain) = 3, 'a plan with no flow keeps all three steps';
  assert exists (select 1 from public.onboarding_steps where onboarding_id = v_setup and template_id = 't-w2'), 'the covered step is on a plan with no flow';
  assert public.wa279_via_setup(v_setup) = false, 'no flow row, not through setup yet';

  -- linking a flow removes the open covered step and nothing else
  insert into public.hub_onboard_flows (candidate_id) select id from public.hub_candidates where name = 'Test Candidate Setup' returning id into v_flow_setup;
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_setup) = 3, 'a flow with no plan yet changes nothing';
  update public.hub_onboard_flows set onboarding_id = v_setup where id = v_flow_setup;
  assert public.wa279_via_setup(v_setup) = true, 'with a flow linked, the plan went through setup';
  assert not exists (select 1 from public.onboarding_steps where onboarding_id = v_setup and template_id = 't-w2'), 'linking the flow removes the open covered step';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_setup and template_id in ('t-w1', 't-d30')) = 2, 'the other steps stay';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_plain) = 3, 'another plan is not touched';

  -- a covered step that is already done stays
  update public.onboarding_steps set done = true, done_at = now(), done_by = 'test' where onboarding_id = v_done and template_id = 't-w2';
  insert into public.hub_onboard_flows (candidate_id) select id from public.hub_candidates where name = 'Test Candidate Done' returning id into v_flow_done;
  update public.hub_onboard_flows set onboarding_id = v_done where id = v_flow_done;
  assert exists (select 1 from public.onboarding_steps where onboarding_id = v_done and template_id = 't-w2' and done), 'a done covered step is kept';
  assert (select count(*) from public.onboarding_steps where onboarding_id = v_done) = 3, 'the plan with a done covered step keeps all three';

  -- a flow created already linked works the same (insert path)
  update public.hub_onboard_flows set onboarding_id = null where id = v_flow_setup;
  assert public.wa279_via_setup(v_setup) = false, 'unlinking takes it back out of setup';
  insert into public.onboarding_steps (onboarding_id, template_id) values (v_setup, 't-w2');
  update public.hub_onboard_flows set onboarding_id = v_setup where id = v_flow_setup;
  assert not exists (select 1 from public.onboarding_steps where onboarding_id = v_setup and template_id = 't-w2'), 'relinking removes the covered step again';

  -- a new active covered template row reaches the no-flow plan only
  insert into public.onboarding_template (id, section, name, setup_covered) values ('t-cov', 'WEEK 1', 'Test covered step', true);
  assert exists (select 1 from public.onboarding_steps where onboarding_id = v_plain and template_id = 't-cov'), 'a new covered row is added to the plan with no flow';
  assert not exists (select 1 from public.onboarding_steps where onboarding_id = v_setup and template_id = 't-cov'), 'a new covered row is not added to a plan that went through setup';
  assert not exists (select 1 from public.onboarding_steps where onboarding_id = v_done and template_id = 't-cov'), 'nor to the other plan that went through setup';

  -- a new row that is not covered still reaches every plan (the other behaviour is unchanged)
  insert into public.onboarding_template (id, section, name) values ('t-norm', 'WEEK 1', 'Test ordinary step');
  select count(*) into v_n from public.onboarding_steps where template_id = 't-norm' and onboarding_id in (v_plain, v_setup, v_done);
  assert v_n = 3, 'an ordinary new row is added to all three plans';
  assert (select due_date from public.onboarding_steps where onboarding_id = v_plain and template_id = 't-norm') = (select started_at + 7 from public.onboardings where id = v_plain), 'with its due date';

  -- reactivation follows the same rule
  update public.onboarding_template set active = false where id = 't-cov';
  assert not exists (select 1 from public.onboarding_steps where template_id = 't-cov'), 'switching a row off removes it from the active plans (as before)';
  update public.onboarding_template set active = true where id = 't-cov';
  assert exists (select 1 from public.onboarding_steps where onboarding_id = v_plain and template_id = 't-cov'), 'switching it back on adds it to the no-flow plan';
  assert not exists (select 1 from public.onboarding_steps where onboarding_id in (v_setup, v_done) and template_id = 't-cov'), 'but not to the plans that went through setup';

  -- turning setup_covered on for an existing row is only a flag: it does not add or remove anything
  update public.onboarding_template set setup_covered = true where id = 't-norm';
  assert (select count(*) from public.onboarding_steps where template_id = 't-norm') = 3, 'flagging a row changes no plan by itself';
  update public.onboarding_template set setup_covered = false where id = 't-norm';

  -- the 90 days check
  assert public.onb_due('90 DAYS', date '2026-11-05') = date '2027-02-03', '90 DAYS from 5 November 2026 is 3 February 2027';
  assert public.onb_due('90 days', date '2026-11-05') = date '2027-02-03', 'the section name is not case sensitive';
  assert public.onb_due('3 MONTHS', date '2026-11-05') = date '2027-02-03', 'and 3 MONTHS is the same 90 days';

  -- the object comments and grants
  assert obj_description('public.wa279_via_setup(bigint)'::regprocedure, 'pg_proc') is not null, 'wa279_via_setup has a comment';
  assert obj_description('public.wa279_flow_plan()'::regprocedure, 'pg_proc') is not null, 'the flow trigger function has a comment';
  assert col_description('public.onboarding_template'::regclass, (select attnum from pg_attribute where attrelid = 'public.onboarding_template'::regclass and attname = 'setup_covered')) is not null, 'the column has a comment';
  assert not has_function_privilege('anon', 'public.wa279_via_setup(bigint)', 'execute'), 'anon cannot run wa279_via_setup';
  assert not has_function_privilege('anon', 'public.wa279_flow_plan()', 'execute'), 'anon cannot run the flow trigger function';
  assert not has_function_privilege('anon', 'public.onboarding_template_propagate()', 'execute'), 'anon cannot run the propagate function';
  assert (select count(*) from pg_trigger where tgname = 'trg_wa279_flow_plan' and not tgisinternal) = 1, 'the trigger is on hub_onboard_flows once';
end $$;

-- ---------------------------------------------------------------- Task 2: role picks for the 60 days and 90 days sections
do $$
declare
  t bigint[] := '{}'; v_id bigint; v_c bigint;
  v_h bigint; v_h2 bigint; v_h3 bigint; v_m bigint; v_l bigint; v_a bigint; v_i bigint; v_pos bigint;
  v_ph bigint; v_ph2 bigint; v_ph3 bigint; v_flow bigint; v_err text; v_o jsonb; v_start date := current_date - 10; v_n int; v_ids bigint[]; v_r record;
  v_aid bigint;
  c_staff constant text := '{"role":"authenticated","email":"w279.staff@example.invalid"}';
  c_mgr constant text := '{"role":"authenticated","email":"w279.mgr@example.invalid"}';
  c_out constant text := '{"role":"authenticated","email":"w279.outsider@example.invalid"}';
  c_hr constant text := '{"role":"authenticated","email":"w279.hr@example.invalid"}';
  c_adm constant text := '{"role":"authenticated","email":"w279.admin@example.invalid"}';
  c_hire constant text := '{"role":"authenticated","email":"w279.rolehire@example.invalid"}';
begin
  perform set_config('request.jwt.claims', c_staff, true);

  -- ---- fixtures: people, a small Academy, a recommend list
  insert into public.team_members (name, email, department, role) values
    ('Test Role Hire', 'w279.rolehire@example.invalid', 'w279role', 'Analyst'),
    ('Test Role Hire Two', 'w279.rolehire2@example.invalid', 'w279role', 'Analyst'),
    ('Test Role Hire Three', 'w279.rolehire3@example.invalid', 'w279role', 'Analyst'),
    ('Test Role Manager', 'w279.mgr@example.invalid', 'w279mgr', 'Manager'),
    ('Test Role Leader', 'w279.leader@example.invalid', 'w279role', 'Lead'),
    ('Test Role Admin', 'w279.admin@example.invalid', 'w279admin', 'Admin'),
    ('Test Role Outsider', 'w279.outsider@example.invalid', 'w279other', 'Analyst');
  select id into v_h from public.team_members where email = 'w279.rolehire@example.invalid';
  select id into v_h2 from public.team_members where email = 'w279.rolehire2@example.invalid';
  select id into v_h3 from public.team_members where email = 'w279.rolehire3@example.invalid';
  select id into v_m from public.team_members where email = 'w279.mgr@example.invalid';
  select id into v_l from public.team_members where email = 'w279.leader@example.invalid';
  select id into v_a from public.team_members where email = 'w279.admin@example.invalid';
  insert into public.hub_roles (email, role) values ('w279.leader@example.invalid', 'leader'), ('w279.admin@example.invalid', 'admin'), ('w279.mgr@example.invalid', 'member');
  insert into public.wa_hr_access (email) values ('w279.hr@example.invalid');

  insert into public.academy_paths (key, name, title) values ('w279pa', 'W279 Path A', 'Path A'), ('w279pb', 'W279 Path B', 'Path B'), ('w279pl', 'W279 Leader Path', 'Leader path');
  -- path A: three modules with the sort 20, 10, 30 (so the order is t2, t1, t3); path B: one module, a tour, a planned module and an inactive one (those three do not count)
  for v_n in 1..13 loop
    insert into public.trainings (category, title, path_group, sort, active, kind, body) values (
      'w279', 'Test module ' || v_n,
      case when v_n in (1, 2, 3) then 'W279 Path A' when v_n in (4, 5, 6, 7) then 'W279 Path B' when v_n = 8 then 'W279 Leader Path' end,
      case v_n when 1 then 20 when 2 then 10 when 3 then 30 else v_n end,
      v_n <> 7, case when v_n = 5 then 'tour' end, case when v_n = 6 then '{"planned": true}'::jsonb end) returning id into v_id;
    t := t || v_id;
  end loop;
  -- t[1..13] = modules 1..13. Recommended for department w279role: path A, path B, then the singles t[11] and t[3] (t[3] is already in path A)
  insert into public.app_config (key, value) values ('onboard_role_recommend',
    jsonb_build_object('by_department', jsonb_build_object('w279role', jsonb_build_object('paths', jsonb_build_array('w279pa', 'w279pb'), 'trainings', jsonb_build_array(t[11], t[3]))),
                       'leaders', jsonb_build_object('paths', jsonb_build_array('w279pl')))::text);

  -- ---- three plans: one with a flow (manager chosen), two without
  v_ph := public.onboarding_assign(v_h, 'test', v_start);
  v_ph2 := public.onboarding_assign(v_h2, 'test', current_date);
  v_ph3 := public.onboarding_assign(v_h3, 'test', current_date - 28);
  insert into public.hub_candidates (name) values ('Test Role Candidate') returning id into v_c;
  insert into public.hub_onboard_flows (candidate_id, manager_member_id, onboarding_id) values (v_c, v_m, v_ph) returning id into v_flow;

  -- ---- wa279_plan_manager: the order, and the fall-back past people who cannot be asked
  assert (select count(*) from public.wa279_plan_manager(v_ph)) = 1 and (select member_id from public.wa279_plan_manager(v_ph)) = v_m, 'the flow manager is the plan manager';
  assert (select email from public.wa279_plan_manager(v_ph)) = 'w279.mgr@example.invalid', 'with the email lower-cased';
  update public.team_members set active = false where id = v_m;
  assert (select array_agg(member_id) from public.wa279_plan_manager(v_ph)) = array[v_l], 'an inactive manager is skipped: the leaders of the hire''s team come next';
  update public.team_members set active = true, email = null where id = v_m;
  assert (select array_agg(member_id) from public.wa279_plan_manager(v_ph)) = array[v_l], 'a manager with no email is skipped too';
  update public.team_members set active = false where id = v_l;
  assert (select array_agg(member_id) from public.wa279_plan_manager(v_ph)) = array[v_a], 'with no active leader in the team the admins are next';
  update public.team_members set active = false where id = v_a;
  assert (select count(*) from public.wa279_plan_manager(v_ph)) = 0, 'and nobody at all when none can be asked';
  update public.team_members set active = true where id in (v_l, v_a);
  update public.team_members set email = 'w279.mgr@example.invalid' where id = v_m;
  -- the org chart: a plan with no flow follows the reporting line (and that beats the team leaders)
  insert into public.org_positions (member_id, title) values (v_m, 'Boss') returning id into v_pos;
  insert into public.org_positions (member_id, title, reports_to) values (v_h2, 'Report', v_pos);
  assert (select array_agg(member_id) from public.wa279_plan_manager(v_ph2)) = array[v_m], 'with no flow the org-chart line manager is the plan manager';
  update public.team_members set active = false where id = v_m;
  assert (select array_agg(member_id) from public.wa279_plan_manager(v_ph2)) = array[v_l], 'an inactive line manager falls back to the team leaders';
  update public.team_members set active = true where id = v_m;
  assert (select count(*) from public.wa279_plan_manager(-1)) = 0, 'a plan that does not exist has no manager';
  assert not has_function_privilege('authenticated', 'public.wa279_plan_manager(bigint)', 'execute'), 'wa279_plan_manager is not open to signed-in people';

  -- ---- the plan steps for the two sections (a plan with nothing picked leaves them open)
  insert into public.onboarding_template (id, section, name, academy_path) values
    ('wa279role60', '60 DAYS', 'Your role trainings', 'role60'), ('wa279role90', '90 DAYS', 'Your role trainings', 'role90');
  assert (select count(*) from public.onboarding_steps where template_id in ('wa279role60', 'wa279role90') and onboarding_id = v_ph and not done) = 2, 'both role steps are on the plan, open';
  assert (select due_date from public.onboarding_steps where template_id = 'wa279role90' and onboarding_id = v_ph) = v_start + 90, 'the 90 days step is due 90 days from day one';
  assert coalesce((public.wa166_path_state(v_h, 'role60') ->> 'complete')::boolean, true) = false, 'role60 with no picks is not complete';
  assert (public.wa166_path_state(v_h, 'role60') ->> 'total')::int = 0, 'and has no total';
  assert (public.wa166_path_state(v_h, 'w279pa') ->> 'total')::int = 3 and (public.wa166_path_state(v_h, 'w279pa') ->> 'key') = 'w279pa', 'an ordinary path key still goes to the live body';
  assert coalesce((public.wa166_path_state(-5, 'role90') ->> 'complete')::boolean, true) = false, 'a member with no plan is not complete';

  -- ---- the manager sees the options
  perform set_config('request.jwt.claims', c_mgr, true);
  v_o := public.wa279_role_options(v_ph);
  assert (v_o ->> 'can_pick')::boolean, 'the manager can pick';
  assert v_o ->> 'member' = 'Test Role Hire' and v_o ->> 'department' = 'w279role', 'it names the hire and the department';
  assert (v_o ->> 'leader')::boolean = false, 'leader is false when the flow does not say';
  assert (v_o ->> 'day')::int = 10, 'day 10 of the plan';
  assert (v_o #>> '{sections,60 DAYS,min}')::int = 2 and (v_o #>> '{sections,60 DAYS,max}')::int = 3, '60 days takes 2 to 3';
  assert (v_o #>> '{sections,90 DAYS,min}')::int = 5 and (v_o #>> '{sections,90 DAYS,max}')::int = 6, '90 days takes 5 to 6';
  assert (select array_agg((x ->> 'training_id')::bigint) from jsonb_array_elements(v_o -> 'recommended') x) = array[t[2], t[1], t[3], t[4], t[11]],
    'recommended: path A in sort order, path B (no tour, planned or inactive module), then the singles, a repeat keeps its first place';
  assert (v_o -> 'recommended' -> 0 ->> 'path') = 'Path A' and (v_o -> 'recommended' -> 4 ->> 'path') is null, 'a module from a path names it; a single has no path';
  update public.hub_onboard_flows set leader = true where id = v_flow;
  assert (select array_agg((x ->> 'training_id')::bigint) from jsonb_array_elements(public.wa279_role_options(v_ph) -> 'recommended') x) = array[t[2], t[1], t[3], t[4], t[8], t[11]],
    'for a leader the leader paths come after the department paths';
  update public.hub_onboard_flows set leader = null where id = v_flow;

  -- someone who has already finished a module sees it marked
  insert into public.training_progress (training_id, person_name, email, status, done_at) values (t[1], 'Test Role Hire', 'w279.rolehire@example.invalid', 'done', now());
  assert (select (x ->> 'done')::boolean from jsonb_array_elements(public.wa279_role_options(v_ph) -> 'recommended') x where (x ->> 'training_id')::bigint = t[1]), 'a finished module is marked done';
  -- fix round 1: done_ids lists every module the hire finished (by name or by email, as wa166_training_done), recommended or not, and nobody else's
  insert into public.training_progress (training_id, person_name, email, status, done_at) values (t[6], 'Someone Else', 'w279.rolehire@example.invalid', 'done', now());
  insert into public.training_progress (training_id, person_name, email, status, done_at) values (t[7], 'Another Person', 'w279.another@example.invalid', 'done', now());
  insert into public.training_progress (training_id, person_name, email, status) values (t[12], 'Test Role Hire', 'w279.rolehire@example.invalid', 'in_progress');
  assert public.wa279_role_options(v_ph) -> 'done_ids' = jsonb_build_array(t[1], t[6]), 'done_ids: the finished modules by name and by email, not someone else''s, not one in progress: ' || (public.wa279_role_options(v_ph) ->> 'done_ids');
  delete from public.training_progress where training_id in (t[6], t[7], t[12]) and person_name in ('Someone Else', 'Another Person', 'Test Role Hire');
  assert (public.wa279_role_options(v_ph) #>> '{sections,60 DAYS,done}')::boolean = false and (public.wa279_role_options(v_ph) #>> '{sections,90 DAYS,done}')::boolean = false, 'a section with nothing picked is not done';

  -- ---- refusals
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3], t[4], t[9]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Pick 2 or 3%', '4 for 60 days is refused with "Pick 2 or 3": ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Pick 2 or 3%', '1 for 60 days is refused';
  v_err := null; begin perform public.wa279_role_save(v_ph, '90 DAYS', array[t[9], t[10], t[11], t[12]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Pick 5 or 6%', '4 for 90 days is refused with "Pick 5 or 6": ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.wa279_role_save(v_ph, '90 DAYS', array[t[9], t[10], t[11], t[12], t[13], t[2], t[3]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Pick 5 or 6%', '7 for 90 days is refused';
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[2]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Pick 2 or 3%', 'the same module twice counts once';
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[1], t[2]]); exception when others then v_err := sqlerrm; end;
  assert v_err like '%already finished%', 'a module the hire has done is refused: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], -1]); exception when others then v_err := sqlerrm; end;
  assert v_err like '%not in the Academy%', 'a module that does not exist is refused';
  v_err := null; begin perform public.wa279_role_save(v_ph, '30 DAYS', array[t[2], t[3]]); exception when others then v_err := sqlerrm; end;
  assert v_err is not null, 'only the two sections can be picked';
  assert (select count(*) from public.onboarding_role_picks) = 0 and (select count(*) from public.academy_assignments) = 0, 'a refused save changes nothing';

  -- an outsider is refused (saving and looking)
  perform set_config('request.jwt.claims', c_out, true);
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Only the manager, HR or an admin%', 'an outsider cannot pick: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.wa279_role_options(v_ph); exception when others then v_err := sqlerrm; end;
  assert v_err is not null, 'nor look';
  perform set_config('request.jwt.claims', '{}', true);
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3]]); exception when others then v_err := sqlerrm; end;
  assert v_err is not null, 'someone not signed in cannot pick';
  assert (select count(*) from public.onboarding_role_picks) = 0, 'still nothing picked';

  -- ---- the manager saves 3 for 60 days
  perform set_config('request.jwt.claims', c_mgr, true);
  v_o := public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3], t[4]]);
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '60 DAYS') = 3, 'three picks for 60 days';
  assert jsonb_array_length(v_o #> '{sections,60 DAYS,picked}') = 3 and jsonb_array_length(v_o #> '{sections,90 DAYS,picked}') = 0, 'and the answer shows them';
  assert (select bool_and(not auto and picked_by = 'Test Role Manager' and assignment_id is not null) from public.onboarding_role_picks where onboarding_id = v_ph), 'by the manager, not auto, each with an assignment';
  assert (select count(*) from public.academy_assignments a join public.onboarding_role_picks k on k.assignment_id = a.id
           where k.onboarding_id = v_ph and a.audience = 'people' and a.active and not a.include_new and a.people = array['w279.rolehire@example.invalid']
             and a.member_ids = array[v_h] and a.due_date = v_start + 60 and a.note = 'Role training (60 days)' and a.training_id = k.training_id
             and a.assigned_by = 'Test Role Manager') = 3, 'the assignments are people-only, for the hire, due on the 60 days date, with the note';
  assert (select count(*) from public.training_progress p join public.onboarding_role_picks k on k.assignment_id = p.assignment_id and k.training_id = p.training_id
           where k.onboarding_id = v_ph and p.person_name = 'Test Role Hire' and p.status = 'assigned' and p.due_date = v_start + 60) = 3, 'so the modules show as assigned to the hire in the Academy';
  assert (select count(*) from public.training_progress where person_name = 'Test Role Hire') = 4, 'and nothing else was assigned (plus the one finished module)';
  assert (select count(*) from public.change_log where entity_type = 'academy_assignment' and field = 'assigned') = 3, 'each assignment is logged';

  -- a module in one section cannot also go in the other
  v_err := null; begin perform public.wa279_role_save(v_ph, '90 DAYS', array[t[2], t[9], t[10], t[11], t[12]]); exception when others then v_err := sqlerrm; end;
  assert v_err like '%already picked for 60 days%', 'a module picked for 60 days cannot go in 90 days: ' || coalesce(v_err, 'no error');
  v_o := public.wa279_role_save(v_ph, '90 DAYS', array[t[9], t[10], t[11], t[12], t[13]]);
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '90 DAYS') = 5, 'five picks for 90 days';
  assert (select count(*) from public.academy_assignments a join public.onboarding_role_picks k on k.assignment_id = a.id
           where k.section = '90 DAYS' and a.due_date = v_start + 90 and a.note = 'Role training (90 days)' and a.active) = 5, 'with the 90 days due date and note';
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[9]]); exception when others then v_err := sqlerrm; end;
  assert v_err like '%already picked for 90 days%', 'and the other way round';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph) = 8, 'a refused save leaves the picks as they were';

  -- ---- saving again without one module ends that assignment, keeps the others
  select assignment_id into v_aid from public.onboarding_role_picks where onboarding_id = v_ph and training_id = t[4];
  select array_agg(assignment_id order by training_id) into v_ids from public.onboarding_role_picks where onboarding_id = v_ph and training_id in (t[2], t[3]);
  perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3]]);
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '60 DAYS') = 2, 'two picks left';
  assert not exists (select 1 from public.onboarding_role_picks where training_id = t[4] and onboarding_id = v_ph), 'the dropped module is no longer picked';
  assert (select not active and ended_at is not null from public.academy_assignments where id = v_aid), 'its assignment has ended';
  assert not exists (select 1 from public.training_progress where assignment_id = v_aid or (training_id = t[4] and person_name = 'Test Role Hire')), 'and the row nobody started is gone from the hire''s Academy';
  assert (select array_agg(assignment_id order by training_id) from public.onboarding_role_picks where onboarding_id = v_ph and training_id in (t[2], t[3])) = v_ids, 'the kept modules keep their assignments';
  assert (select bool_and(active) from public.academy_assignments where id = any (v_ids)), 'which are still running';
  -- a module the hire has started keeps its progress when the pick is dropped
  update public.training_progress set status = 'in_progress', started_at = now(), pct = 40 where training_id = t[9] and person_name = 'Test Role Hire';
  perform public.wa279_role_save(v_ph, '90 DAYS', array[t[10], t[11], t[12], t[13], t[5]]);
  assert exists (select 1 from public.training_progress where training_id = t[9] and person_name = 'Test Role Hire' and pct = 40 and assignment_id is null), 'a dropped module the hire had started keeps its progress, no longer tied to the assignment';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '90 DAYS') = 5, 'and the 90 days list is the new five';

  -- ---- HR and an admin may pick too; the hire may look but not pick
  perform set_config('request.jwt.claims', c_hr, true);
  v_o := public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3], t[4]]);
  assert (select picked_by from public.onboarding_role_picks where training_id = t[4] and onboarding_id = v_ph) = 'w279.hr@example.invalid', 'HR can pick (named by email when not on the roster)';
  perform set_config('request.jwt.claims', c_adm, true);
  perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3]]);
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '60 DAYS') = 2, 'an admin can pick';
  perform set_config('request.jwt.claims', c_hire, true);
  v_o := public.wa279_role_options(v_ph);
  assert (v_o ->> 'can_pick')::boolean = false and jsonb_array_length(v_o #> '{sections,60 DAYS,picked}') = 2, 'the hire sees their picks but cannot change them';
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[3], t[4]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'Only the manager%', 'the hire cannot pick for themselves';
  perform set_config('request.jwt.claims', c_mgr, true);

  -- ---- the plan step ticks when every picked module is done
  assert not (select done from public.onboarding_steps where onboarding_id = v_ph and template_id = 'wa279role60'), 'role60 is open while nothing is finished';
  update public.training_progress set status = 'done', done_at = now() where training_id = t[2] and person_name = 'Test Role Hire';
  assert not (select done from public.onboarding_steps where onboarding_id = v_ph and template_id = 'wa279role60'), 'and while only one of two is finished';
  assert (public.wa166_path_state(v_h, 'role60') ->> 'done')::int = 1 and (public.wa166_path_state(v_h, 'role60') ->> 'total')::int = 2, 'the path state counts 1 of 2';
  update public.training_progress set status = 'done', done_at = now() where training_id = t[3] and person_name = 'Test Role Hire';
  assert (select done and done_by = 'Avenue Academy' from public.onboarding_steps where onboarding_id = v_ph and template_id = 'wa279role60'), 'role60 ticks when both picked modules are done';
  assert (public.wa166_path_state(v_h, 'role60') ->> 'complete')::boolean, 'the path state says complete';
  assert not (select done from public.onboarding_steps where onboarding_id = v_ph and template_id = 'wa279role90'), 'role90 stays open: its modules are not done';
  assert not (select done from public.onboarding_steps where onboarding_id = v_ph2 and template_id = 'wa279role60'), 'a plan with an empty list is never ticked';
  -- fix round 1: a section whose picks are all finished is done, and its list can't change any more (not even saved as it is)
  v_o := public.wa279_role_options(v_ph);
  assert (v_o #>> '{sections,60 DAYS,done}')::boolean and not (v_o #>> '{sections,90 DAYS,done}')::boolean, 'options: 60 days is done, 90 days is not';
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3], t[4]]); exception when others then v_err := sqlerrm; end;
  assert v_err = 'These trainings are all done, so the list can''t change now.', 'a done section refuses a change: ' || coalesce(v_err, 'no error');
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3]]); exception when others then v_err := sqlerrm; end;
  assert v_err = 'These trainings are all done, so the list can''t change now.', 'and the same list saved again';
  perform set_config('request.jwt.claims', c_hr, true);
  v_err := null; begin perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3], t[4]]); exception when others then v_err := sqlerrm; end;
  assert v_err like 'These trainings are all done%', 'HR is refused too';
  perform set_config('request.jwt.claims', c_mgr, true);
  assert (select array_agg(training_id order by training_id) from public.onboarding_role_picks where onboarding_id = v_ph and section = '60 DAYS') = array[t[2], t[3]], 'the done list is as it was';
  assert (select done from public.onboarding_steps where onboarding_id = v_ph and template_id = 'wa279role60'), 'and the step stays ticked';
  -- a finished pick can stay in a list that is not all done, and that list can still change
  update public.training_progress set status = 'done', done_at = now() where training_id = t[10] and person_name = 'Test Role Hire';
  assert not (public.wa279_role_options(v_ph) #>> '{sections,90 DAYS,done}')::boolean, 'one of five finished: 90 days is not done';
  perform public.wa279_role_save(v_ph, '90 DAYS', array[t[10], t[11], t[12], t[13], t[9]]);
  assert (select array_agg(training_id order by training_id) from public.onboarding_role_picks where onboarding_id = v_ph and section = '90 DAYS') = array[t[9], t[10], t[11], t[12], t[13]], 'a list that is not all done can change, its finished pick kept';

  -- ---- the Hub's own pick
  perform set_config('request.jwt.claims', c_staff, true);
  insert into public.training_progress (training_id, person_name, email, status, done_at) values (t[1], 'Test Role Hire Three', 'w279.rolehire3@example.invalid', 'done', now());
  -- no switch yet: nothing, whatever the day
  assert public.wa279_role_autopick(current_date + 1) ->> 'reason' = 'off', 'with no onboard_role_picks_since there is no autopick';
  insert into public.app_config (key, value) values ('onboard_role_picks_since', '') on conflict (key) do update set value = excluded.value;
  assert public.wa279_role_autopick(current_date + 1) ->> 'reason' = 'off', 'an empty switch is off';
  insert into public.app_config (key, value) values ('onboard_role_picks_since', 'not a date') on conflict (key) do update set value = excluded.value;
  assert public.wa279_role_autopick(current_date + 1) ->> 'reason' = 'off', 'so is something that is not a date';
  -- since = 5 days ago: day 29 of the third plan is tomorrow, but the Hub waits until since + 7
  update public.app_config set value = (current_date - 5)::text where key = 'onboard_role_picks_since';
  assert public.wa279_role_autopick(current_date + 1) ->> 'reason' = 'too early', 'before onboard_role_picks_since + 7 days nothing is picked';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph3) = 0, 'nothing for the third plan';
  update public.app_config set value = (current_date - 30)::text where key = 'onboard_role_picks_since';
  -- day 28: nothing
  assert (public.wa279_role_autopick(current_date) ->> 'picked')::int = 0, 'on day 28 the Hub picks nothing';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph3) = 0, 'day 28: no picks';
  -- day 29: three, in recommended order, not the finished module
  v_o := public.wa279_role_autopick(current_date + 1);
  assert (v_o ->> 'picked')::int >= 3, 'on day 29 the Hub picks';
  assert (select array_agg(training_id order by id) from public.onboarding_role_picks where onboarding_id = v_ph3 and section = '60 DAYS') = array[t[2], t[3], t[4]],
    'day 29: three, in recommended order, skipping the module already done';
  assert (select bool_and(auto and picked_by = 'the Hub' and assignment_id is not null) from public.onboarding_role_picks where onboarding_id = v_ph3), 'auto, by the Hub, each with an assignment';
  assert (select count(*) from public.academy_assignments a join public.onboarding_role_picks k on k.assignment_id = a.id
           where k.onboarding_id = v_ph3 and a.audience = 'people' and a.due_date = current_date - 28 + 60 and a.assigned_by = 'the Hub' and a.note = 'Role training (60 days)') = 3, 'with people-only assignments due on the 60 days date';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph3 and section = '90 DAYS') = 0, 'nothing for 90 days before day 59';
  -- a second run changes nothing, and a manager's own full list is left alone
  v_n := (select count(*) from public.onboarding_role_picks);
  perform public.wa279_role_autopick(current_date + 1);
  assert (select count(*) from public.onboarding_role_picks) = v_n, 'a second run picks nothing more';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '60 DAYS' and auto) = 0, 'a list the manager filled is not touched';
  -- day 59: the 90 days list gets what recommended modules are left
  perform public.wa279_role_autopick(current_date + 31);
  assert (select array_agg(training_id) from public.onboarding_role_picks where onboarding_id = v_ph3 and section = '90 DAYS') = array[t[11]], 'day 59: the 90 days list takes the remaining recommended module';
  assert not has_function_privilege('authenticated', 'public.wa279_role_autopick(date)', 'execute') and has_function_privilege('service_role', 'public.wa279_role_autopick(date)', 'execute'), 'only the service role can run the autopick';

  -- ---- who can reach what
  assert not has_table_privilege('authenticated', 'public.onboarding_role_picks', 'select') and not has_table_privilege('anon', 'public.onboarding_role_picks', 'insert'), 'the picks table has no direct grants';
  assert (select relrowsecurity from pg_class where oid = 'public.onboarding_role_picks'::regclass), 'with row level security on';
  assert has_function_privilege('authenticated', 'public.wa279_role_save(bigint,text,bigint[])', 'execute') and not has_function_privilege('anon', 'public.wa279_role_save(bigint,text,bigint[])', 'execute'), 'role_save is for signed-in people only';
  assert has_function_privilege('authenticated', 'public.wa279_role_options(bigint,date)', 'execute') and not has_function_privilege('anon', 'public.wa279_role_options(bigint,date)', 'execute'), 'and so is role_options';
  assert not has_function_privilege('authenticated', 'public.wa279_pick_add(bigint,text,bigint,text,boolean)', 'execute'), 'the internal helpers are closed';
  assert obj_description('public.wa279_role_save(bigint,text,bigint[])'::regprocedure, 'pg_proc') is not null, 'the functions carry comments';
  assert (select count(*) from pg_proc where proname like 'wa279%' and obj_description(oid, 'pg_proc') is null) = 0, 'every wa279 function has a comment';
end $$;

-- ---------------------------------------------------------------- Task 3: policies open 10 minutes before they can be signed
do $$
declare
  v_m bigint; v_onb bigint; v_msg text; v_o jsonb; v_s jsonb; v_def text; v_step bigint; v_open timestamptz;
  c_pol constant text := '{"role":"authenticated","email":"W279.Pol@example.invalid"}';
  c_svc constant text := '{"role":"service_role"}';
begin
  insert into public.wa_policies (key, title, url, required, active) values
    ('w279-a', 'Test policy A', 'https://example.invalid/a', true, true),
    ('w279-b', 'Test policy B', 'https://example.invalid/b', true, true),
    ('w279-opt', 'Test optional policy', 'https://example.invalid/o', false, true),
    ('w279-off', 'Test inactive policy', 'https://example.invalid/x', true, false),
    ('w279-old', 'Test old policy', 'https://example.invalid/old', false, true);
  -- the Policies step is on the plan from the start
  insert into public.onboarding_template (id, section, name, academy_path) values ('t-pol', 'WEEK 1', 'Test Policies step', 'policies');
  insert into public.team_members (name, email, department, role) values ('Test Policy Person', 'w279.pol@example.invalid', 'w279test', 'Analyst');
  v_m := (select id from public.team_members where email = 'w279.pol@example.invalid');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w279.staff@example.invalid"}', true);
  v_onb := public.onboarding_assign(v_m, 'test');
  v_step := (select id from public.onboarding_steps where onboarding_id = v_onb and template_id = 't-pol');
  assert v_step is not null, 'the plan carries the Policies step';

  -- a sign-off from before the rule stays: inserted while the rule is off, untouched after
  alter table public.wa_policy_signoffs disable trigger trg_wa279_policy_read;
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-old');
  alter table public.wa_policy_signoffs enable trigger trg_wa279_policy_read;
  assert exists (select 1 from public.wa_policy_signoffs where email = 'w279.pol@example.invalid' and policy_key = 'w279-old'), 'a sign-off from before stays';

  -- no setting: 10 minutes. The caller's email comes in capitals in the token and is judged lower-cased.
  assert not exists (select 1 from public.app_config where key = 'policy_read_minutes'), 'no setting in the test data';
  perform set_config('request.jwt.claims', c_pol, true);

  -- sign without opening: refused
  v_msg := null;
  begin insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-a');
  exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'Read it for 10 more minutes first', 'sign without opening is refused: ' || coalesce(v_msg, 'no error');

  -- an unknown or inactive policy cannot be opened
  v_msg := null;
  begin perform public.wa279_policy_open('w279-nothing'); exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'That policy was not found', 'an unknown policy cannot be opened: ' || coalesce(v_msg, 'no error');
  v_msg := null;
  begin perform public.wa279_policy_open('w279-off'); exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'That policy was not found', 'an inactive policy cannot be opened';

  -- open, then sign at once: refused with the minutes left
  v_o := public.wa279_policy_open('w279-a');
  assert (v_o ->> 'minutes')::int = 10 and (v_o ->> 'opened_at') is not null and (v_o ->> 'unlock_at') is not null, 'open returns opened_at, unlock_at and minutes';
  assert (v_o ->> 'unlock_at')::timestamptz = (v_o ->> 'opened_at')::timestamptz + interval '10 minutes', 'unlock_at is ten minutes after opened_at';
  v_msg := null;
  begin insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-a');
  exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'Read it for 10 more minutes first', 'open then sign at once is refused: ' || coalesce(v_msg, 'no error');

  -- a second open keeps the first time; one row; the email is lower case; minutes left round up
  update public.wa_policy_opens set opened_at = now() - interval '3 minutes 30 seconds' where policy_key = 'w279-a';
  v_open := (select opened_at from public.wa_policy_opens where policy_key = 'w279-a');
  v_o := public.wa279_policy_open('w279-a');
  assert (v_o ->> 'opened_at')::timestamptz = v_open, 'a second open keeps the first opened_at';
  assert (select count(*) from public.wa_policy_opens where policy_key = 'w279-a') = 1 and (select email from public.wa_policy_opens where policy_key = 'w279-a') = 'w279.pol@example.invalid', 'one row, lower case email';
  v_msg := null;
  begin insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-a');
  exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'Read it for 7 more minutes first', 'minutes left are rounded up (6.5 becomes 7): ' || coalesce(v_msg, 'no error');

  -- the state shows the caller's opens only
  v_s := public.wa279_policy_state();
  assert v_s ? 'w279-a' and (v_s -> 'w279-a') ? 'opened_at' and (v_s -> 'w279-a') ? 'unlock_at' and not (v_s ? 'w279-b'), 'the state lists what the caller opened';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w279.other@example.invalid"}', true);
  assert public.wa279_policy_state() = '{}'::jsonb, 'someone else sees none of it';
  perform set_config('request.jwt.claims', c_pol, true);

  -- opened 11 minutes ago: signed; one of two required does not tick the step
  update public.wa_policy_opens set opened_at = now() - interval '11 minutes' where policy_key = 'w279-a';
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-a');
  assert exists (select 1 from public.wa_policy_signoffs where policy_key = 'w279-a' and email = 'w279.pol@example.invalid'), 'an open back-dated 11 minutes can be signed';
  assert not (select done from public.onboarding_steps where id = v_step), 'one of two required policies does not tick the step';
  assert (public.wa166_path_state(v_m, 'policies') ->> 'done')::int = 1 and (public.wa166_path_state(v_m, 'policies') ->> 'total')::int = 2, 'path state counts the required, active policies (1 of 2)';
  assert not (public.wa166_path_state(v_m, 'policies') ->> 'complete')::boolean, 'not complete at 1 of 2';

  -- a policy that is not required is signed at once and does not count
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-opt');
  assert exists (select 1 from public.wa_policy_signoffs where policy_key = 'w279-opt'), 'a policy that is not required is signed at once';
  assert not (public.wa166_path_state(v_m, 'policies') ->> 'complete')::boolean, 'an optional sign-off does not complete the path';

  -- the service role signs at once; the last required one ticks the Policies step by itself
  perform set_config('request.jwt.claims', c_svc, true);
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol@example.invalid', 'Test Policy Person', 'w279-b');
  assert exists (select 1 from public.wa_policy_signoffs where policy_key = 'w279-b'), 'the service role signs at once';
  assert (select done and done_by = 'Avenue Academy' from public.onboarding_steps where id = v_step), 'the Policies step ticks itself once both required policies are signed';
  assert (public.wa166_path_state(v_m, 'policies') ->> 'complete')::boolean, 'path state is complete';
  assert (public.wa166_path_state(v_m, 'role60') ->> 'key') = 'role60', 'the role keys still answer';
  assert (public.wa166_path_state(v_m, 'nothing-here') ->> 'complete')::boolean = false, 'other keys still run the live body';

  -- a row for another email is not this rule's business; a sign-off with no team member behind it still goes in
  perform set_config('request.jwt.claims', c_pol, true);
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.nobody@example.invalid', 'Test Nobody', 'w279-a');
  perform set_config('request.jwt.claims', c_svc, true);
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.nobody@example.invalid', 'Test Nobody', 'w279-b');
  assert (select count(*) from public.wa_policy_signoffs where email = 'w279.nobody@example.invalid') = 2, 'no member behind a sign-off, no problem';

  -- the setting: 0 is off, 25 is 25, text falls back to 10, never less than 1 minute
  insert into public.app_config (key, value) values ('policy_read_minutes', '0');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w279.zero@example.invalid"}', true);
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.zero@example.invalid', 'Test Zero', 'w279-a');
  assert exists (select 1 from public.wa_policy_signoffs where email = 'w279.zero@example.invalid'), 'policy_read_minutes 0: signed at once, nothing opened';
  update public.app_config set value = '25' where key = 'policy_read_minutes';
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w279.long@example.invalid"}', true);
  assert (public.wa279_policy_open('w279-a') ->> 'minutes')::int = 25, 'the setting is read';
  v_msg := null;
  begin insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.long@example.invalid', 'Test Long', 'w279-a');
  exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'Read it for 25 more minutes first', 'a longer rule is used: ' || coalesce(v_msg, 'no error');
  update public.app_config set value = 'ten' where key = 'policy_read_minutes';
  v_msg := null;
  begin insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.long@example.invalid', 'Test Long', 'w279-a');
  exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'Read it for 10 more minutes first', 'a setting that is not a number falls back to 10: ' || coalesce(v_msg, 'no error');
  update public.app_config set value = '1' where key = 'policy_read_minutes';
  update public.wa_policy_opens set opened_at = now() - interval '1 second' where email = 'w279.long@example.invalid';
  v_msg := null;
  begin insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.long@example.invalid', 'Test Long', 'w279-a');
  exception when raise_exception then v_msg := sqlerrm; end;
  assert v_msg = 'Read it for 1 more minutes first', 'never less than 1 minute: ' || coalesce(v_msg, 'no error');
  delete from public.app_config where key = 'policy_read_minutes';

  -- a sync that blows up never fails a sign-off
  perform set_config('request.jwt.claims', c_svc, true);
  insert into public.team_members (name, email, department, role) values ('Test Policy Two', 'w279.pol2@example.invalid', 'w279test', 'Analyst');
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"w279.staff@example.invalid"}', true);
  perform public.onboarding_assign((select id from public.team_members where email = 'w279.pol2@example.invalid'), 'test');
  perform set_config('request.jwt.claims', c_svc, true);
  v_def := pg_get_functiondef('public.wa166_onb_sync(bigint)'::regprocedure);
  create or replace function public.wa166_onb_sync(p_onb bigint) returns integer language plpgsql security definer set search_path to '' as $f$ begin raise exception 'sync is broken'; end $f$;
  insert into public.wa_policy_signoffs (email, name, policy_key) values ('w279.pol2@example.invalid', 'Test Policy Two', 'w279-a');
  assert exists (select 1 from public.wa_policy_signoffs where email = 'w279.pol2@example.invalid'), 'a broken sync does not fail the sign-off';
  execute v_def;
  assert public.wa166_onb_sync(v_onb) is not null, 'the real sync is back';

  -- who can reach what
  assert not has_table_privilege('authenticated', 'public.wa_policy_opens', 'select') and not has_table_privilege('authenticated', 'public.wa_policy_opens', 'insert') and not has_table_privilege('anon', 'public.wa_policy_opens', 'select'), 'opens have no direct grants';
  assert (select relrowsecurity from pg_class where oid = 'public.wa_policy_opens'::regclass), 'with row level security on';
  assert has_function_privilege('authenticated', 'public.wa279_policy_open(text)', 'execute') and not has_function_privilege('anon', 'public.wa279_policy_open(text)', 'execute'), 'open is for signed-in people only';
  assert has_function_privilege('authenticated', 'public.wa279_policy_state()', 'execute') and not has_function_privilege('anon', 'public.wa279_policy_state()', 'execute'), 'and so is state';
  assert not has_function_privilege('authenticated', 'public.wa279_policy_rule()', 'execute') and not has_function_privilege('authenticated', 'public.wa279_policy_sync()', 'execute'), 'the trigger functions are closed';
  assert not has_function_privilege('authenticated', 'public.wa279_policies_state(bigint)', 'execute'), 'the path helper is closed';
  assert (select count(*) from pg_trigger where tgrelid = 'public.wa_policy_signoffs'::regclass and not tgisinternal and tgname in ('trg_wa279_policy_read', 'trg_wa279_policy_sync')) = 2, 'both triggers are on the sign-offs once';
  assert (select count(*) from pg_proc where proname like 'wa279%' and obj_description(oid, 'pg_proc') is null) = 0, 'every wa279 function still has a comment';
end $$;

-- ---------------------------------------------------------------- Task 4: the behind check, the pick reminders, and the Task 2 hardening
do $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_m1 bigint; v_l2 bigint; v_a bigint; v_b bigint; v_c bigint; v_d bigint; v_e bigint; v_f bigint; v_g bigint; v_h bigint; v_i bigint;
  pa bigint; pb bigint; pc bigint; pd bigint; pe bigint; pf bigint; pg bigint; ph bigint; pi bigint;
  t bigint[] := '{}'; v_id bigint; v_n int; v_r jsonb; v_p jsonb; v_def text; v_msg text; v_cnt int;
  c_staff constant text := '{"role":"authenticated","email":"w279.staff@example.invalid"}';
begin
  perform set_config('request.jwt.claims', c_staff, true);
  -- every plan the earlier sections left is finished, so this section sees only its own
  update public.onboardings set status = 'completed';
  -- and so are the extra template rows they left, so a new plan has only the ordinary Week 1, Week 2 and 30 days rows and the two role steps
  update public.onboarding_template set active = false where id not in ('t-w1', 't-w2', 't-d30', 'wa279role60', 'wa279role90');
  delete from public.w279_edge_calls;

  -- ---- fixtures: two leaders of the hires' team (the first one by id is the manager), HR's list, nine hires, three modules
  insert into public.team_members (name, email, department, role) values
    ('Test Lead One', 'w279.lead1@example.invalid', 'w279beh', 'Lead'),
    ('Test Lead Two', 'w279.lead2@example.invalid', 'w279beh', 'Lead');
  select id into v_m1 from public.team_members where email = 'w279.lead1@example.invalid';
  select id into v_l2 from public.team_members where email = 'w279.lead2@example.invalid';
  insert into public.hub_roles (email, role) values ('w279.lead1@example.invalid', 'leader'), ('w279.lead2@example.invalid', 'leader');
  -- the people the earlier sections made leaders or admins of other teams cannot be the manager of these plans (a different team), but the admins are the last resort:
  -- keep them for now, and switch them off in the no-manager case below
  insert into public.team_members (name, email, department, role) values
    ('Test Behind A', 'w279.beha@example.invalid', 'w279beh', 'Analyst'), ('Test Behind B', 'w279.behb@example.invalid', 'w279beh', 'Analyst'),
    ('Test Behind C', 'w279.behc@example.invalid', 'w279beh', 'Analyst'), ('Test Behind D', 'w279.behd@example.invalid', 'w279beh', 'Analyst'),
    ('Test Behind E', 'w279.behe@example.invalid', 'w279beh', 'Analyst'), ('Test Behind F', 'w279.behf@example.invalid', 'w279beh', 'Analyst'),
    ('Test Behind G', 'w279.behg@example.invalid', 'w279beh', 'Analyst'), ('Test Behind H', 'w279.behh@example.invalid', 'w279beh', 'Analyst'),
    ('Test Behind I', 'w279.behi@example.invalid', 'w279beh', 'Analyst');
  select id into v_a from public.team_members where email = 'w279.beha@example.invalid';
  select id into v_b from public.team_members where email = 'w279.behb@example.invalid';
  select id into v_c from public.team_members where email = 'w279.behc@example.invalid';
  select id into v_d from public.team_members where email = 'w279.behd@example.invalid';
  select id into v_e from public.team_members where email = 'w279.behe@example.invalid';
  select id into v_f from public.team_members where email = 'w279.behf@example.invalid';
  select id into v_g from public.team_members where email = 'w279.behg@example.invalid';
  select id into v_h from public.team_members where email = 'w279.behh@example.invalid';
  select id into v_i from public.team_members where email = 'w279.behi@example.invalid';
  for v_n in 1..4 loop
    insert into public.trainings (category, title, path_group, sort, active) values ('w279', 'Behind module ' || v_n, null, v_n, true) returning id into v_id;
    t := t || v_id;
  end loop;
  insert into public.app_config (key, value) values
    ('hr_notify_emails', 'w279.hr1@example.invalid, W279.HR2@example.invalid'),
    ('onboard_role_recommend', jsonb_build_object('by_department', jsonb_build_object('w279beh', jsonb_build_object('trainings', jsonb_build_array(t[3], t[1], t[2], t[4]))))::text)
  on conflict (key) do update set value = excluded.value;
  update public.app_config set value = 'off' where key = 'onboard_behind_on';
  update public.app_config set value = (v_today - 30)::text where key = 'onboard_behind_since';
  update public.app_config set value = '' where key = 'onboard_role_picks_since';

  -- ---- the settings, the kinds, the cron entry and the grants the migration made
  assert (select value from public.app_config where key = 'onboard_behind_on') = 'off', 'the switch is off';
  assert (select count(*) from public.hub_notification_kinds where key in ('onboard_behind', 'onboard_behind_lead', 'onboard_role_pick') and hub and slack and not email and not channel_only and active) = 3,
    'the three notification kinds are there, Hub and Slack on';
  assert (select title from public.hub_notification_kinds where key = 'onboard_behind') = 'Onboarding: you''re behind', 'the hire''s kind is titled as designed';
  assert (select schedule from cron.job where jobname = 'wa-onboard-behind') = '35 12 * * 1-5', 'the cron entry is weekdays at 12:35';
  assert (select command from cron.job where jobname = 'wa-onboard-behind') = 'select public.wa279_onboard_tick()', 'and calls the job';
  assert has_function_privilege('service_role', 'public.wa279_onboard_tick(boolean)', 'execute') and not has_function_privilege('authenticated', 'public.wa279_onboard_tick(boolean)', 'execute')
         and not has_function_privilege('anon', 'public.wa279_onboard_tick(boolean)', 'execute'), 'only the service role runs the job';
  assert not has_function_privilege('authenticated', 'public.wa279_behind_list(bigint)', 'execute') and not has_function_privilege('authenticated', 'public.wa279_tell(text,text,text,text,text,text)', 'execute'), 'the helpers are closed';
  assert not has_table_privilege('authenticated', 'public.onboarding_behind_log', 'select') and (select relrowsecurity from pg_class where oid = 'public.onboarding_behind_log'::regclass), 'the log is closed';

  -- ---- plan A: started 10 days ago, its Week 1 step is open and more than 2 days late
  pa := public.onboarding_assign(v_a, 'test', v_today - 10);
  assert jsonb_array_length(public.wa279_behind_list(pa)) = 1, 'one late step';
  v_r := public.wa279_behind_list(pa) -> 0;
  assert v_r ->> 'template_id' = 't-w1' and v_r ->> 'name' = 'Test step in week 1' and v_r ->> 'section' = 'WEEK 1' and (v_r ->> 'due_date')::date = v_today - 3, 'the late step: id, name, section, due date';
  update public.onboarding_steps set due_date = v_today - 2 where onboarding_id = pa and template_id = 't-w1';
  assert public.wa279_behind_list(pa) = '[]'::jsonb, 'two days late is not late yet';
  update public.onboarding_steps set due_date = v_today - 3 where onboarding_id = pa and template_id = 't-w1';

  -- off: nothing is sent, but the dry run still lists the plan
  v_r := public.wa279_onboard_tick();
  assert (v_r ->> 'off')::boolean and (v_r ->> 'sent')::int = 0, 'off: nothing sent';
  assert (select count(*) from public.w279_edge_calls) = 0 and (select count(*) from public.onboarding_behind_log) = 0, 'off: no call, no log';
  v_r := public.wa279_onboard_tick(true);
  assert (v_r ->> 'dry')::boolean and jsonb_array_length(v_r -> 'plan') = 1 and (v_r -> 'plan' -> 0 ->> 'onboarding_id')::bigint = pa, 'the dry run lists plan A even when the switch is off';
  assert (select count(*) from public.w279_edge_calls) = 0 and (select count(*) from public.onboarding_behind_log) = 0, 'and sends and records nothing';
  assert (v_r -> 'plan' -> 0 -> 'to') = '["w279.beha@example.invalid", "w279.lead1@example.invalid"]'::jsonb, 'the plan names the hire and the first leader only';

  -- on: one message to the hire, one to the manager
  update public.app_config set value = 'on' where key = 'onboard_behind_on';
  v_r := public.wa279_onboard_tick();
  assert (v_r ->> 'behind')::int = 1 and (v_r ->> 'sent')::int = 1 and v_r -> 'failed' = '[]'::jsonb, 'on: one plan messaged';
  assert (select count(*) from public.w279_edge_calls where fn = 'notify') = 2 and (select count(*) from public.w279_edge_calls) = 2, 'one notify to the hire and one to the manager, no device so no hub-push';
  v_p := (select payload from public.w279_edge_calls where payload ->> 'to_email' = 'w279.beha@example.invalid');
  assert v_p ->> 'event' = 'onboard_behind' and v_p ->> 'url' = '#mypage' and v_p ->> 'title' = 'You''re behind on onboarding', 'the hire: event, url, title';
  assert v_p ->> 'body' = 'You''re behind on 1 onboarding step from Week 1: Test step in week 1.', 'the hire: body (' || (v_p ->> 'body') || ')';
  assert v_p ->> 'tag' = 'onboard-behind-' || pa || '-' || v_today, 'the hire: a tag that is stable for the plan and the day';
  assert v_p ->> 'text' = 'You''re behind on 1 onboarding step from Week 1: Test step in week 1. <https://hub.welfareavenue.com/#mypage|Open the Hub>', 'the hire: the Slack text';
  assert (select array_agg(k order by k) from jsonb_object_keys(v_p) k) = array['body', 'event', 'tag', 'text', 'title', 'to_email', 'url'], 'exactly the fields notify reads';
  v_p := (select payload from public.w279_edge_calls where payload ->> 'to_email' = 'w279.lead1@example.invalid');
  assert v_p ->> 'event' = 'onboard_behind_lead' and v_p ->> 'url' = '#hrcentre/onboarding' and v_p ->> 'title' = 'Test Behind A is behind on onboarding', 'the manager: event, url, title';
  assert v_p ->> 'body' = 'Test Behind A is behind on 1 onboarding step from Week 1: Test step in week 1.', 'the manager: body';
  assert v_p ->> 'text' like '% <https://hub.welfareavenue.com/#hrcentre/onboarding|Open the Hub>', 'the manager: the Slack text links to Onboarding';
  assert not exists (select 1 from public.w279_edge_calls where payload ->> 'to_email' = 'w279.lead2@example.invalid'), 'only the first leader is messaged';
  assert (select count(*) from public.onboarding_behind_log where onboarding_id = pa and kind = 'onboard_behind' and late = 1) = 1, 'one log row';

  -- the pause: the same day, 6 days later: nothing; 7 days later: again
  delete from public.w279_edge_calls;
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0, 'a second run the same day sends nothing';
  update public.onboarding_behind_log set sent_at = now() - interval '6 days';
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0, 'six days later it sends nothing';
  update public.onboarding_behind_log set sent_at = now() - interval '7 days';
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 2, 'seven days later it sends again (hire and manager, not HR yet)';
  assert (select count(*) from public.onboarding_behind_log where onboarding_id = pa and kind = 'onboard_behind') = 2, 'a second log row';

  -- the third message adds HR (split on commas and spaces, lower-cased)
  delete from public.w279_edge_calls;
  update public.onboarding_behind_log set sent_at = now() - interval '8 days';
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 4, 'the third message goes to the hire, the manager and both HR addresses';
  assert (select array_agg(payload ->> 'to_email' order by payload ->> 'to_email') from public.w279_edge_calls where payload ->> 'event' = 'onboard_behind_lead')
         = array['w279.hr1@example.invalid', 'w279.hr2@example.invalid', 'w279.lead1@example.invalid'], 'HR hears as onboard_behind_lead';
  assert (select count(*) from public.w279_edge_calls where payload ->> 'event' = 'onboard_behind') = 1, 'and the hire once';
  assert (select (detail ->> 'hr')::boolean from public.onboarding_behind_log where onboarding_id = pa order by id desc limit 1), 'the log says HR was added';

  -- notify carries the Hub notification itself: the job never calls hub-push, so no one gets two
  delete from public.w279_edge_calls;
  update public.onboarding_behind_log set sent_at = now() - interval '8 days';
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls where fn = 'notify') = 4 and (select count(*) from public.w279_edge_calls where fn = 'hub-push') = 0, 'four notify calls and no hub-push call';
  update public.onboardings set status = 'completed' where id = pa;
  delete from public.w279_edge_calls;

  -- ---- a plan started before onboard_behind_since sends nothing
  pb := public.onboarding_assign(v_b, 'test', v_today - 40);
  assert jsonb_array_length(public.wa279_behind_list(pb)) >= 1, 'plan B has late steps';
  v_r := public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0 and (v_r ->> 'behind')::int = 0, 'a plan started before onboard_behind_since sends nothing';
  assert jsonb_array_length(public.wa279_onboard_tick(true) -> 'plan') = 0, 'and is not in the dry run';
  update public.app_config set value = '' where key = 'onboard_behind_since';
  assert (public.wa279_onboard_tick() ->> 'behind')::int = 0, 'with no since date no plan counts';
  update public.onboardings set status = 'completed' where id = pb;

  -- ---- an unpicked role step does not make the hire late; once the section has a pick it counts
  update public.app_config set value = (v_today - 200)::text where key = 'onboard_behind_since';
  pc := public.onboarding_assign(v_c, 'test', v_today - 70);
  update public.onboarding_steps set done = true where onboarding_id = pc and template_id <> 'wa279role60';
  assert exists (select 1 from public.onboarding_steps where onboarding_id = pc and template_id = 'wa279role60' and not done and due_date < v_today - 2), 'the 60 days role step is open and past due';
  assert public.wa279_behind_list(pc) = '[]'::jsonb, 'with no picks the role step is not late';
  v_r := public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0 and (v_r ->> 'behind')::int = 0, 'so nobody is messaged';
  insert into public.onboarding_role_picks (onboarding_id, section, training_id, picked_by) values (pc, '60 DAYS', t[1], 'test');
  assert (select array_agg(x ->> 'template_id') from jsonb_array_elements(public.wa279_behind_list(pc)) x) = array['wa279role60'], 'with a pick in its section the role step counts';
  insert into public.onboarding_steps (onboarding_id, template_id, due_date) values (pc, 'wa279role90', v_today - 10) on conflict (onboarding_id, template_id) do update set due_date = excluded.due_date, done = false;
  assert (select count(*) from jsonb_array_elements(public.wa279_behind_list(pc))) = 1, 'a pick in the other section does not bring the 90 days step in';
  update public.onboardings set status = 'completed' where id = pc;
  delete from public.onboarding_role_picks where onboarding_id = pc;
  update public.app_config set value = (v_today - 30)::text where key = 'onboard_behind_since';

  -- ---- the list: oldest first, five names, the first section; several late steps in one message
  pd := public.onboarding_assign(v_d, 'test', v_today - 25);   -- WEEK 1 (due day 7) and WEEK 2 (due day 14) are late; 30 DAYS is not
  insert into public.onboarding_template (id, section, name, sort) values
    ('t-x1', 'WEEK 1', 'Extra one', 1), ('t-x2', 'WEEK 1', 'Extra two', 2), ('t-x3', 'WEEK 1', 'Extra three', 3), ('t-x4', 'WEEK 1', 'Extra four', 4), ('t-x5', 'WEEK 1', 'Extra five', 5);
  assert (select count(*) from jsonb_array_elements(public.wa279_behind_list(pd))) = 7, 'seven late steps';
  assert public.wa279_behind_list(pd) -> 0 ->> 'section' = 'WEEK 1' and public.wa279_behind_list(pd) -> 6 ->> 'section' = 'WEEK 2', 'oldest first';
  perform public.wa279_onboard_tick();
  v_p := (select payload from public.w279_edge_calls where payload ->> 'to_email' = 'w279.behd@example.invalid');
  assert v_p ->> 'body' = 'You''re behind on 7 onboarding steps from Week 1: Test step in week 1, Extra one, Extra two, Extra three, Extra four.', 'N steps, the section of the oldest, the first five names (' || (v_p ->> 'body') || ')';
  update public.onboarding_template set active = false where id in ('t-x1', 't-x2', 't-x3', 't-x4', 't-x5');
  update public.onboardings set status = 'completed' where id = pd;
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;

  -- ---- the manager gets onboard_role_pick on day 21, and not again for 7 days
  update public.app_config set value = (v_today - 60)::text where key = 'onboard_role_picks_since';
  pe := public.onboarding_assign(v_e, 'test', v_today - 20);
  update public.onboarding_steps set done = true where onboarding_id = pe and template_id <> 't-d30';   -- one step stays open so the plan stays active
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0, 'day 20: no reminder yet';
  update public.onboardings set started_at = v_today - 21 where id = pe;
  v_r := public.wa279_onboard_tick();
  assert (v_r ->> 'role_pick')::int = 1 and (select count(*) from public.w279_edge_calls) = 1, 'day 21: one reminder ' || v_r::text;
  v_p := (select payload from public.w279_edge_calls);
  assert v_p ->> 'event' = 'onboard_role_pick' and v_p ->> 'to_email' = 'w279.lead1@example.invalid' and v_p ->> 'url' = '#hrcentre/onboarding', 'to the manager, as onboard_role_pick';
  assert v_p ->> 'title' = 'Pick Test Behind E''s role trainings', 'the title names the hire';
  assert v_p ->> 'body' = 'Pick 2 or 3 trainings for Test Behind E''s 60 days and 5 or 6 for their 90 days. The Hub picks for you on day 29 and day 59 if you don''t.', 'both short: the body names both';
  assert v_p ->> 'tag' = 'onboard-role-pick-' || pe || '-' || v_today and v_p ->> 'text' like '%|Open the Hub>', 'the tag and the Slack text';
  delete from public.w279_edge_calls;
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0, 'not again the same day';
  update public.onboarding_behind_log set sent_at = now() - interval '6 days' where kind = 'onboard_role_pick';
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 0, 'not 6 days later';
  update public.onboarding_behind_log set sent_at = now() - interval '7 days' where kind = 'onboard_role_pick';
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls) = 1, '7 days later it is sent again';
  -- only the short section is named, and only while its auto-pick day is ahead
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;
  insert into public.trainings (category, title, active) select 'w279', 'Filler ' || g, true from generate_series(1, 7) g;
  insert into public.trainings (category, title, active) select 'w279', 'Part ' || g, true from generate_series(1, 2) g;
  insert into public.onboarding_role_picks (onboarding_id, section, training_id, picked_by)
    select pe, '60 DAYS', id, 'test' from public.trainings where title like 'Part %';
  perform public.wa279_onboard_tick();
  assert (select payload ->> 'body' from public.w279_edge_calls) = 'Pick 5 or 6 trainings for Test Behind E''s 90 days. The Hub picks for you on day 59 if you don''t.', '60 days full: only the 90 days is asked, with its own day';
  delete from public.onboarding_role_picks where onboarding_id = pe;
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;
  insert into public.onboarding_role_picks (onboarding_id, section, training_id, picked_by)
    select pe, '90 DAYS', id, 'test' from public.trainings where title like 'Filler %' limit 5;
  perform public.wa279_onboard_tick();
  assert (select payload ->> 'body' from public.w279_edge_calls) = 'Pick 2 or 3 trainings for Test Behind E''s 60 days. The Hub picks for you on day 29 if you don''t.', '90 days full: only the 60 days is asked, with its own day';
  -- day 29: the 60 days auto-pick day has passed, so only the 90 days is asked; day 59: nothing is asked any more
  delete from public.onboarding_role_picks where onboarding_id = pe;
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;
  update public.onboardings set started_at = v_today - 29 where id = pe;
  perform public.wa279_onboard_tick();
  assert (select payload ->> 'body' from public.w279_edge_calls where payload ->> 'event' = 'onboard_role_pick') = 'Pick 5 or 6 trainings for Test Behind E''s 90 days. The Hub picks for you on day 59 if you don''t.', 'day 29: the 60 days is no longer asked';
  delete from public.onboarding_role_picks where onboarding_id = pe;
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;
  update public.onboardings set started_at = v_today - 59 where id = pe;
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls where payload ->> 'event' = 'onboard_role_pick') = 0, 'day 59: both auto-pick days have passed, no reminder';
  delete from public.onboarding_role_picks where onboarding_id = pe;
  update public.onboardings set started_at = v_today - 21 where id = pe;
  -- both lists full: no reminder
  delete from public.w279_edge_calls;
  update public.onboarding_behind_log set sent_at = now() - interval '8 days' where kind = 'onboard_role_pick';
  insert into public.onboarding_role_picks (onboarding_id, section, training_id, picked_by)
    select pe, case when n <= 2 then '60 DAYS' else '90 DAYS' end, tr.id, 'test'
      from (select id, row_number() over (order by id) as n from public.trainings where title like 'Filler %') tr(id, n);
  perform public.wa279_onboard_tick();
  assert (select count(*) from public.w279_edge_calls where payload ->> 'event' = 'onboard_role_pick') = 0, 'with 2 and 5 picked there is no reminder';
  delete from public.onboarding_role_picks where onboarding_id = pe;
  update public.onboardings set status = 'completed' where id = pe;
  update public.app_config set value = '' where key = 'onboard_role_picks_since';
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;

  -- ---- the tick runs the Hub's own pick first (day 29, three recommended modules in config order)
  update public.app_config set value = (v_today - 60)::text where key = 'onboard_role_picks_since';
  pf := public.onboarding_assign(v_f, 'test', v_today - 29);
  update public.onboarding_steps set done = true where onboarding_id = pf and template_id <> 't-d30';   -- one step stays open so the plan stays active
  v_r := public.wa279_onboard_tick();
  assert (v_r -> 'autopick' ->> 'picked')::int = 3, 'the job ran the autopick: three picks';
  assert (select array_agg(training_id order by id) from public.onboarding_role_picks where onboarding_id = pf and section = '60 DAYS') = array[t[3], t[1], t[2]] and (select bool_and(auto) from public.onboarding_role_picks where onboarding_id = pf), 'in the configured order, auto';
  assert (public.wa279_onboard_tick(true) -> 'autopick' ->> 'skipped') = 'dry run', 'a dry run does not pick';
  delete from public.onboarding_role_picks where onboarding_id = pf;
  assert (public.wa279_onboard_tick(true) ->> 'dry')::boolean and (select count(*) from public.onboarding_role_picks where onboarding_id = pf) = 0, 'the dry run left no picks';
  update public.onboardings set status = 'completed' where id = pf;
  update public.app_config set value = '' where key = 'onboard_role_picks_since';
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;

  -- ---- a manager who left: the message goes to the next in order, and the other plans are still processed
  pg := public.onboarding_assign(v_g, 'test', v_today - 10);
  ph := public.onboarding_assign(v_h, 'test', v_today - 10);
  update public.team_members set active = false where id = v_m1;
  v_r := public.wa279_onboard_tick();
  assert (v_r ->> 'behind')::int = 2 and v_r -> 'failed' = '[]'::jsonb, 'both plans are processed';
  assert (select count(*) from public.w279_edge_calls where payload ->> 'to_email' = 'w279.lead2@example.invalid') = 2 and not exists (select 1 from public.w279_edge_calls where payload ->> 'to_email' = 'w279.lead1@example.invalid'),
    'the next leader is told for both plans, the one who left is not';
  assert (select count(*) from public.w279_edge_calls where payload ->> 'event' = 'onboard_behind') = 2, 'and both hires';

  -- one plan fails: it is listed, nothing of it was sent, the other plan is still done
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;
  create function public.w279_boom() returns trigger language plpgsql as $f$ begin if new.onboarding_id = (select max(id) from public.onboardings where member_id = (select id from public.team_members where email = 'w279.behg@example.invalid')) then raise exception 'boom'; end if; return new; end $f$;
  create trigger w279_boom before insert on public.onboarding_behind_log for each row execute function public.w279_boom();
  v_r := public.wa279_onboard_tick();
  assert jsonb_array_length(v_r -> 'failed') = 1 and (v_r -> 'failed' -> 0 ->> 'onboarding_id')::bigint = pg and v_r -> 'failed' -> 0 ->> 'error' = 'boom', 'the failing plan is listed';
  assert (v_r ->> 'behind')::int = 1 and exists (select 1 from public.w279_edge_calls where payload ->> 'to_email' = 'w279.behh@example.invalid') and not exists (select 1 from public.w279_edge_calls where payload ->> 'to_email' = 'w279.behg@example.invalid'),
    'plan H was done, plan G sent nothing';
  drop trigger w279_boom on public.onboarding_behind_log;
  drop function public.w279_boom();

  -- no manager at all: the hire is still messaged, and other plans are unaffected
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;
  update public.team_members set active = false where lower(email) in (select lower(email) from public.hub_roles where role in ('leader', 'admin'));
  assert (select count(*) from public.wa279_plan_manager(pg)) = 0, 'nobody can be asked to manage plan G';
  pi := public.onboarding_assign(v_i, 'test', v_today - 10);
  v_r := public.wa279_onboard_tick();
  assert (v_r ->> 'behind')::int = 3 and v_r -> 'failed' = '[]'::jsonb, 'no manager is not an error: all three plans are processed';
  assert (select count(*) from public.w279_edge_calls where payload ->> 'event' = 'onboard_behind') = 3 and (select count(*) from public.w279_edge_calls where payload ->> 'event' = 'onboard_behind_lead') = 0, 'three hires told, no manager to tell';
  update public.team_members set active = true where lower(email) in (select lower(email) from public.hub_roles where role in ('leader', 'admin'));
  update public.onboardings set status = 'completed' where id in (pg, ph, pi);
  delete from public.w279_edge_calls; delete from public.onboarding_behind_log;

  -- ---- the Task 2 hardening
  -- 1. the recommended list is ordered by its ordinal, in the options too
  select pg_get_functiondef('public.wa279_role_options(bigint,date)'::regprocedure) into v_def;
  assert v_def ~ 'order by r\.ord\)', 'role_options orders the recommended list by its ordinal';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  assert (select array_agg((x ->> 'training_id')::bigint) from jsonb_array_elements(public.wa279_role_options(pa) -> 'recommended') x) = array[t[3], t[1], t[2], t[4]], 'the options list the recommended modules in the configured order';

  -- 2. the autopick: each plan on its own, under the same row lock the manager's save takes
  select pg_get_functiondef('public.wa279_role_autopick(date)'::regprocedure) into v_def;
  assert v_def ~ 'for update of ob' and v_def ~ 'exception when others', 'the autopick locks the plan row and catches a failure per plan';
  assert (select pg_get_functiondef('public.wa279_role_save(bigint,text,bigint[])'::regprocedure)) ~ 'for update of ob', 'the manager''s save takes the same lock';
  update public.app_config set value = (v_today - 60)::text where key = 'onboard_role_picks_since';
  update public.team_members set active = true where id in (v_m1, v_l2);
  perform set_config('request.jwt.claims', c_staff, true);
  pf := public.onboarding_assign(v_f, 'test', v_today - 30);
  pg := public.onboarding_assign(v_g, 'test', v_today - 30);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);   -- the options are for the manager, HR, an admin or the hire: the service role may look
  create function public.w279_boom2() returns trigger language plpgsql as $f$ begin if new.onboarding_id = (select max(id) from public.onboardings where member_id = (select id from public.team_members where email = 'w279.behf@example.invalid')) then raise exception 'pick boom'; end if; return new; end $f$;
  create trigger w279_boom2 before insert on public.onboarding_role_picks for each row execute function public.w279_boom2();
  v_r := public.wa279_role_autopick();
  assert jsonb_array_length(v_r -> 'failed') = 1 and (v_r -> 'failed' -> 0 ->> 'onboarding_id')::bigint = pf and v_r -> 'failed' -> 0 ->> 'error' = 'pick boom', 'the autopick lists the plan that failed';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = pf) = 0, 'nothing of the failed plan is kept';
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = pg and section = '60 DAYS') = 3 and (v_r ->> 'picked')::int = 3 and (v_r ->> 'plans')::int = 1, 'the other plan still got its picks';
  drop trigger w279_boom2 on public.onboarding_role_picks;
  drop function public.w279_boom2();
  v_r := public.wa279_role_autopick();
  assert v_r -> 'failed' = '[]'::jsonb and (select count(*) from public.onboarding_role_picks where onboarding_id = pf and section = '60 DAYS') = 3, 'without the fault the same run picks for the plan';
  v_r := public.wa279_role_autopick();
  assert (v_r ->> 'picked')::int = 0, 'and a second run picks nothing more';

  -- 3. a malformed recommend setting never raises: it means no recommendations
  delete from public.onboarding_role_picks where onboarding_id in (pf, pg);
  foreach v_msg in array array['{not json', '[1,2', 'null', '5', '"text"', '{"by_department": 5}', '{"by_department": {"w279beh": {"trainings": ["abc", 5.5, {"a": 1}, null, true, "99999999999999999999999"], "paths": "x"}}, "leaders": {"paths": 7}}',
                               '{"by_department": {"w279beh": {"trainings": "12", "paths": {"a": 1}}}}'] loop
    update public.app_config set value = v_msg where key = 'onboard_role_recommend';
    assert (select count(*) from public.wa279_recommended(pf)) = 0, 'recommended gives nothing for: ' || v_msg;
    assert public.wa279_role_options(pf) -> 'recommended' = '[]'::jsonb, 'the options give nothing for: ' || v_msg;
    v_r := public.wa279_role_autopick();
    assert (v_r ->> 'picked')::int = 0 and v_r -> 'failed' = '[]'::jsonb, 'the autopick picks nothing and does not fail for: ' || v_msg;
  end loop;
  -- one good id among bad ones is still used
  update public.app_config set value = jsonb_build_object('by_department', jsonb_build_object('w279beh', jsonb_build_object('trainings', jsonb_build_array('abc', t[2], null, 'x1'))))::text where key = 'onboard_role_recommend';
  assert (select array_agg(training_id) from public.wa279_recommended(pf)) = array[t[2]], 'a good id among bad ones is kept';
  -- a blank setting is no setting
  update public.app_config set value = '   ' where key = 'onboard_role_recommend';
  assert (select count(*) from public.wa279_recommended(pf)) = 0, 'a blank setting gives nothing';
  update public.onboardings set status = 'completed' where id in (pf, pg);
end $$;

select 'w279sql: all assertions passed' as result;
rollback;

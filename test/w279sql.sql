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
  -- a finished pick can stay when the list is saved again
  perform public.wa279_role_save(v_ph, '60 DAYS', array[t[2], t[3]]);
  assert (select count(*) from public.onboarding_role_picks where onboarding_id = v_ph and section = '60 DAYS') = 2, 'saving the list again with its finished modules is allowed';
  assert (select done from public.onboarding_steps where onboarding_id = v_ph and template_id = 'wa279role60'), 'and the step stays ticked';

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

select 'w279sql: all assertions passed' as result;
rollback;

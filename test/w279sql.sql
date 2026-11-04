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

select 'w279sql: all assertions passed' as result;
rollback;

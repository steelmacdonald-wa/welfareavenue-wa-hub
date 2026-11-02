-- Welfare Avenue Hub: wave275 (275a), Task 1. Assertions for build/wa275a_streamlined.sql.
-- Assumes wave271 (a, b, c, d) and the wave275 migration are already loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises.
-- Offline: node test/w271sql.mjs (PGlite, with test/w271schema.sql). On live, only at the release gate and only with Steel's yes: paste this file into execute_sql
-- once the migration has been applied; afterwards the test rows are gone.
-- Every row is invented (Test Person, example.invalid). Fixtures sit in the department code w275test so no real team is touched.

begin;

-- ---------------------------------------------------------------- fixtures
insert into public.team_members (name, email, department, role) values
  ('Test Manager One', 'w275.mgr1@example.invalid', 'w275test', 'Coordinator'),
  ('Test Manager Two', 'w275.mgr2@example.invalid', 'w275test', 'Coordinator'),
  ('Test Other Member', 'w275.other@example.invalid', 'w275test', 'Analyst');
insert into public.team_members (name, email, department, role, active) values
  ('Test Manager Gone', 'w275.gone@example.invalid', 'w275test', 'Coordinator', false);
insert into public.hub_roles (email, role) values ('w275.admin@example.invalid', 'admin'), ('w275.mgr1@example.invalid', 'member'), ('w275.other@example.invalid', 'member');
insert into public.wa_hr_access (email) values ('w275.hr@example.invalid');

-- six candidates, none with an offer sent yet
insert into public.hub_candidates (name, email, status, offer_hours, onboard_manager_id, role) values
  ('Test Person Alpha', 'w275.alpha@example.invalid', 'offer', 6, (select id from public.team_members where email = 'w275.mgr1@example.invalid'), 'Test Role Alpha'),
  ('Test Person Beta', 'w275.beta@example.invalid', 'offer', 4, (select id from public.team_members where email = 'w275.mgr2@example.invalid'), 'Test Role Beta'),
  ('Test Person Gamma', 'w275.gamma@example.invalid', 'offer', 8, (select id from public.team_members where email = 'w275.mgr1@example.invalid'), 'Test Role Gamma'),
  ('Test Person NoManager', 'w275.nomgr@example.invalid', 'offer', 4, null, 'Test Role None'),
  ('Test Person Old Path', 'w275.old@example.invalid', 'offer', null, null, 'Test Role Old'),
  ('Test Person Gone Mgr', 'w275.gonemgr@example.invalid', 'offer', 4, (select id from public.team_members where email = 'w275.gone@example.invalid'), 'Test Role Gone');
insert into public.hub_candidates (name, email, status, practice, offer_hours, onboard_manager_id) values
  ('Test Person Practice', 'w275.practice@example.invalid', 'offer', true, 4, (select id from public.team_members where email = 'w275.mgr1@example.invalid'));

select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);

-- ---------------------------------------------------------------- the objects, comments and access rules
do $$
declare n int;
begin
  -- new columns exist with the right types
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'offer_hours' and data_type = 'integer'), 'offer_hours is an integer';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'onboard_manager_id' and data_type = 'bigint'), 'onboard_manager_id is a bigint';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'hours_confirmed_at' and data_type = 'timestamp with time zone'), 'hours_confirmed_at is a timestamptz';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members' and column_name = 'availability' and data_type = 'jsonb'), 'availability is jsonb';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members' and column_name = 'availability_at' and data_type = 'timestamp with time zone'), 'availability_at is a timestamptz';
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows'
    and column_name in ('proposed_call_at', 'proposed_one_on_one_at', 'proposed_by', 'proposed_at', 'hire_answer', 'hire_answered_at', 'setup_ticks', 'welcome_sent_at', 'accounts_at', 'ask_availability');
  assert n = 10, format('ten new flow columns, found %s', n);
  assert (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'ask_availability') = 'true', 'ask_availability defaults on';
  assert (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'ask_availability') = 'NO', 'ask_availability is not null';
  assert (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'setup_ticks') = 'jsonb', 'setup_ticks is jsonb';

  -- COMMENT on every new column and function (release checklist)
  select count(*) into n from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null
     and ((c.relname = 'hub_candidates' and a.attname in ('offer_hours', 'onboard_manager_id', 'hours_confirmed_at'))
       or (c.relname = 'team_members' and a.attname in ('availability', 'availability_at'))
       or (c.relname = 'hub_onboard_flows' and a.attname in ('proposed_call_at', 'proposed_one_on_one_at', 'proposed_by', 'proposed_at', 'hire_answer', 'hire_answered_at', 'setup_ticks', 'welcome_sent_at', 'accounts_at', 'ask_availability')));
  assert n = 0, format('%s new columns have no comment', n);
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa275\_%' and obj_description(p.oid, 'pg_proc') is null;
  assert n = 0, format('%s wa275 functions have no comment', n);
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa275\_%';
  assert n >= 7, format('the wa275 functions exist (found %s)', n);
  assert obj_description('public.wa271_cand_accepted()'::regprocedure, 'pg_proc') like '%wave275%', 'the accept trigger function comment mentions wave275';
  assert obj_description('public.wa271_ready_list()'::regprocedure, 'pg_proc') like '%wave275%', 'the ready list comment mentions wave275';
  assert exists (select 1 from pg_trigger where tgname = 'wa275_offer_sent' and tgrelid = 'public.hub_candidates'::regclass), 'the offer-sent trigger exists';
  assert obj_description('public.wa275_offer_sent()'::regprocedure, 'pg_proc') is not null, 'the offer-sent trigger function is commented';
  assert exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'hub_candidates_onboard_manager_idx'), 'onboard_manager_id has its index';

  -- every new function has an empty search_path and is a security definer where it reads other tables
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa275\_%'
     and coalesce(p.proconfig[1], '') <> 'search_path=""';
  assert n = 0, format('%s wa275 functions have no empty search_path', n);

  -- grants: the signed-in functions are open to authenticated and the service key, never to a signed-out visitor
  assert not has_function_privilege('anon', 'public.wa275_manager_of(bigint)', 'execute') and has_function_privilege('authenticated', 'public.wa275_manager_of(bigint)', 'execute')
     and has_function_privilege('service_role', 'public.wa275_manager_of(bigint)', 'execute'), 'manager_of grants';
  assert not has_function_privilege('anon', 'public.wa275_my_cards()', 'execute') and has_function_privilege('authenticated', 'public.wa275_my_cards()', 'execute')
     and has_function_privilege('service_role', 'public.wa275_my_cards()', 'execute'), 'my_cards grants';
  assert not has_function_privilege('anon', 'public.wa275_availability_set(jsonb)', 'execute') and has_function_privilege('authenticated', 'public.wa275_availability_set(jsonb)', 'execute'), 'availability_set grants';
  assert not has_function_privilege('anon', 'public.wa275_availability_of(bigint)', 'execute') and has_function_privilege('authenticated', 'public.wa275_availability_of(bigint)', 'execute'), 'availability_of grants';
  assert not has_function_privilege('anon', 'public.wa275_flow_row(bigint)', 'execute') and not has_function_privilege('authenticated', 'public.wa275_flow_row(bigint)', 'execute'), 'flow_row is not callable from the browser';
  assert not has_function_privilege('anon', 'public.wa275_week_of(bigint)', 'execute') and not has_function_privilege('authenticated', 'public.wa275_week_of(bigint)', 'execute'), 'week_of (no access check of its own) is not callable from the browser';
  assert not has_function_privilege('anon', 'public.wa275_offer_sent()', 'execute') and not has_function_privilege('authenticated', 'public.wa275_offer_sent()', 'execute'), 'the trigger function is not callable';
  assert not has_function_privilege('anon', 'public.wa275_availability_ok(jsonb)', 'execute'), 'a signed-out visitor cannot run the availability check';

  -- the new flow columns are readable by HR (row security limits them to HR and admins), pw_nonce is still hidden
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'proposed_call_at', 'select') and has_column_privilege('authenticated', 'public.hub_onboard_flows', 'hire_answer', 'select')
     and has_column_privilege('authenticated', 'public.hub_onboard_flows', 'setup_ticks', 'select') and has_column_privilege('authenticated', 'public.hub_onboard_flows', 'ask_availability', 'select'), 'HR can read the new flow columns';
  assert not has_column_privilege('authenticated', 'public.hub_onboard_flows', 'pw_nonce', 'select'), 'pw_nonce is still hidden';
  assert not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'insert') and not has_table_privilege('authenticated', 'public.hub_onboard_flows', 'update'), 'still no direct writes to flows from the browser';
  assert has_column_privilege('authenticated', 'public.hub_candidates', 'hours_confirmed_at', 'select'), 'HR can read hours_confirmed_at';
end $$;

-- ---------------------------------------------------------------- settings and kinds
do $$
declare n int; k record;
begin
  assert (select value from public.app_config where key = 'onboard_auto_hub') = 'on', 'onboard_auto_hub is on';
  assert (select value from public.app_config where key = 'onboard_propose_lead_hours') = '48', 'onboard_propose_lead_hours is 48';
  assert (select value from public.app_config where key = 'onboard_yes_lead_hours') = '24', 'onboard_yes_lead_hours is 24';
  assert not exists (select 1 from public.app_config where key = 'onboard_v2_since'), 'onboard_v2_since is absent until release';

  select count(*) into n from public.hub_notification_kinds where key in ('onboard_propose', 'onboard_answer', 'onboard_ready');
  assert n = 3, 'the three new notification kinds exist';
  for k in select * from public.hub_notification_kinds where key in ('onboard_propose', 'onboard_answer', 'onboard_ready') loop
    assert k.grp = 'people' and k.grp_title = 'People and HR', k.key || ' sits in People and HR';
    assert k.hub and k.slack and not k.email and not k.channel_only and k.active, k.key || ' has a Hub and a Slack switch and no email';
    assert k.title is not null and k.blurb is not null and k.says is not null and k.example_title is not null and k.example_body is not null and k.example_url is not null and k.audience is not null and k.sender is not null, k.key || ' is fully described';
    assert k.title !~ '\mAI\M' and k.blurb !~ '\mAI\M' and k.says !~ '\mAI\M' and k.example_title !~ '\mAI\M' and k.example_body !~ '\mAI\M', k.key || ' has no "AI"';
    assert position(chr(8212) in (k.title || k.blurb || k.says || k.example_title || k.example_body || k.audience)) = 0, k.key || ' has no em dash';
  end loop;
  assert (select count(distinct sort) from public.hub_notification_kinds where key in ('onboard_propose', 'onboard_answer', 'onboard_ready')) = 3, 'the three kinds have their own order';
  assert (select count(*) from public.hub_notification_kinds where key in ('onboard_date', 'onboard_grid', 'onboard_remind', 'timeoff_request')) = 4, 'the existing kinds are untouched';
end $$;

-- ---------------------------------------------------------------- an offer sent creates an offered flow with the manager
update public.hub_candidates set offer_sent_at = now() where name = 'Test Person Alpha';
update public.hub_candidates set offer_sent_at = now() where name in ('Test Person Beta', 'Test Person Gamma', 'Test Person NoManager', 'Test Person Gone Mgr', 'Test Person Practice');
do $$
declare f record; n int;
begin
  select * into f from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Alpha');
  assert f.id is not null, 'sending the offer made a flow';
  assert f.status = 'offered', format('the flow is offered, not %s', f.status);
  assert f.manager_member_id = (select id from public.team_members where email = 'w275.mgr1@example.invalid'), 'the flow has the offer''s manager';
  assert f.practice = false and f.ask_availability = true and f.setup_ticks = '{}'::jsonb and f.hire_answer is null and f.proposed_call_at is null, 'the new flow starts clean';
  assert (select practice from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Practice')), 'a practice offer makes a practice flow';
  assert (select manager_member_id from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person NoManager')) is null, 'no manager chosen: the flow is still made, with none';
  assert (select count(*) from public.hub_onboard_flows where candidate_id in (select id from public.hub_candidates where name like 'Test Person %' and email like 'w275.%')) = 6, 'six offers sent, six flows (the old path candidate has none)';
  assert not exists (select 1 from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Old Path')), 'no offer sent, no flow';

  -- a second offer_sent_at update creates no second flow (changed, cleared and set again, and set to the same value)
  update public.hub_candidates set offer_sent_at = now() + interval '1 hour' where name = 'Test Person Alpha';
  update public.hub_candidates set offer_sent_at = null where name = 'Test Person Alpha';
  update public.hub_candidates set offer_sent_at = now() + interval '2 hours' where name = 'Test Person Alpha';
  update public.hub_candidates set offer_sent_at = offer_sent_at where name = 'Test Person Alpha';
  select count(*) into n from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Alpha');
  assert n = 1, format('still one flow after the offer is touched again, found %s', n);
  assert (select id from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Alpha')) = f.id, 'and it is the same flow';

  -- an edit that does not touch offer_sent_at starts nothing
  update public.hub_candidates set notes = 'Test note' where name = 'Test Person Old Path';
  assert not exists (select 1 from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Old Path')), 'an unrelated edit starts nothing';
end $$;

-- ---------------------------------------------------------------- accepting moves offered to waiting and keeps the proposal
update public.hub_onboard_flows set proposed_call_at = timestamptz '2026-12-01 15:00+00', proposed_one_on_one_at = timestamptz '2026-12-02 15:00+00',
  proposed_by = 'w275.mgr1@example.invalid', proposed_at = now(), hire_answer = 'yes', hire_answered_at = now(),
  setup_ticks = '{"gmail": true}'::jsonb, ask_availability = false, accounts_at = now(), welcome_sent_at = now()
 where candidate_id = (select id from public.hub_candidates where name = 'Test Person Alpha');
update public.hub_onboard_flows set status = 'backed_out' where candidate_id = (select id from public.hub_candidates where name = 'Test Person Gone Mgr');
update public.hub_candidates set accepted_on = date '2026-11-20', hours_confirmed_at = now() where name = 'Test Person Alpha';
do $$
declare f record;
begin
  select * into f from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Alpha');
  assert (select count(*) from public.hub_onboard_flows where candidate_id = f.candidate_id) = 1, 'accepting made no second flow';
  assert f.status = 'waiting', format('accepting moved the flow to waiting, not %s', f.status);
  assert f.proposed_call_at = timestamptz '2026-12-01 15:00+00' and f.proposed_one_on_one_at = timestamptz '2026-12-02 15:00+00' and f.proposed_by = 'w275.mgr1@example.invalid'
     and f.proposed_at is not null and f.hire_answer = 'yes' and f.hire_answered_at is not null and f.setup_ticks = '{"gmail": true}'::jsonb and f.ask_availability = false
     and f.accounts_at is not null and f.welcome_sent_at is not null, 'accepting kept the proposal and everything else on the flow';
  assert f.manager_member_id = (select id from public.team_members where email = 'w275.mgr1@example.invalid'), 'and the manager';

  -- a flow that is not offered is left alone when accepted_on is set (the backed out one stays backed out)
  update public.hub_candidates set accepted_on = date '2026-11-21' where name = 'Test Person Gone Mgr';
  assert (select status from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Gone Mgr')) = 'backed_out', 'accepting does not move a flow that is not offered';

  -- a candidate with no flow at all (the wave271 path: no offer_sent_at trigger fired) still gets one on Accept
  update public.hub_candidates set accepted_on = date '2026-11-22' where name = 'Test Person Old Path';
  assert (select status from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Old Path')) = 'waiting', 'a candidate with no flow gets a waiting flow on Accept, as before';
  assert (select count(*) from public.hub_onboard_flows where candidate_id = (select id from public.hub_candidates where name = 'Test Person Old Path')) = 1, 'exactly one';

  -- a second acceptance edit makes nothing new
  update public.hub_candidates set accepted_on = date '2026-11-23' where name = 'Test Person Alpha';
  assert (select status from public.hub_onboard_flows where candidate_id = f.candidate_id) = 'waiting', 'a later edit of accepted_on changes nothing';
end $$;

-- ---------------------------------------------------------------- the flow status check takes offered and still refuses nonsense
do $$
begin
  begin
    update public.hub_onboard_flows set status = 'bogus' where candidate_id = (select id from public.hub_candidates where name = 'Test Person Beta');
    assert false, 'a bogus status should be refused';
  exception when check_violation then null; end;
  begin
    update public.hub_onboard_flows set hire_answer = 'maybe' where candidate_id = (select id from public.hub_candidates where name = 'Test Person Beta');
    assert false, 'a bogus hire answer should be refused';
  exception when check_violation then null; end;
  begin
    update public.hub_candidates set offer_hours = 5 where name = 'Test Person Beta';
    assert false, 'five hours a week is not one of the offered values';
  exception when check_violation then null; end;
  update public.hub_candidates set offer_hours = 8 where name = 'Test Person Beta';
  update public.hub_candidates set offer_hours = 4 where name = 'Test Person Beta';
end $$;

-- ---------------------------------------------------------------- who is a flow's manager
create temp table w275_ids on commit drop as
  select (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person Alpha') as alpha,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person Beta') as beta,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person Gamma') as gamma,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person NoManager') as nomgr,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person Gone Mgr') as gonemgr,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person Practice') as practice,
         (select id from public.team_members where email = 'w275.mgr1@example.invalid') as mgr1,
         (select id from public.team_members where email = 'w275.mgr2@example.invalid') as mgr2,
         (select id from public.team_members where email = 'w275.other@example.invalid') as other;
grant select on w275_ids to authenticated, anon, service_role;

select set_config('request.jwt.claims', '{"role":"authenticated","email":"W275.Mgr1@Example.Invalid"}', true);   -- the case of the email does not matter
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert public.wa275_manager_of(i.alpha), 'the manager (any email case) is the manager of their hire''s flow';
  assert public.wa275_manager_of(i.gamma), 'and of their other hire''s flow';
  assert not public.wa275_manager_of(i.beta), 'but not of another manager''s hire';
  assert not public.wa275_manager_of(i.nomgr), 'nor of a flow with no manager';
  assert not public.wa275_manager_of(i.gonemgr), 'a manager is not the manager of a flow that belongs to someone else';
  assert not public.wa275_manager_of(-1), 'a flow that does not exist has no manager';
  assert not public.wa275_manager_of(null), 'null is false, not null';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.other@example.invalid"}', true);
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert not public.wa275_manager_of(i.alpha) and not public.wa275_manager_of(i.beta) and not public.wa275_manager_of(i.nomgr), 'another member is no one''s manager';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert public.wa275_manager_of(i.alpha) and public.wa275_manager_of(i.beta) and public.wa275_manager_of(i.nomgr), 'HR may act on every flow';
  assert not public.wa275_manager_of(-1), 'even HR gets false for a flow that does not exist';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.admin@example.invalid"}', true);
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert public.wa275_manager_of(i.alpha) and public.wa275_manager_of(i.beta), 'an admin may act on every flow';
end $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert public.wa275_manager_of(i.alpha) and public.wa275_manager_of(i.beta), 'the service key may act on every flow';
end $$;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert not public.wa275_manager_of(i.alpha), 'a signed-out visitor is nobody''s manager';
end $$;
-- a manager who left the roster (inactive) is not one
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.gone@example.invalid"}', true);
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert not public.wa275_manager_of(i.gonemgr), 'an inactive roster person is not a manager';
end $$;

-- ---------------------------------------------------------------- my cards: only this manager's flows, in the shape of the ready list
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
create temp table w275_ready on commit drop as select public.wa271_ready_list() as j;
grant select on w275_ready to authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.mgr1@example.invalid"}', true);
do $$
declare i record; cards jsonb; ready jsonb; k text; row_k jsonb; ready_row jsonb;
begin
  select * into i from w275_ids;
  cards := public.wa275_my_cards();   -- a plain member: must not raise
  assert jsonb_typeof(cards) = 'array', 'my cards is an array';
  assert jsonb_array_length(cards) = 3, format('the manager has three cards (Alpha, Gamma, Practice), found %s', jsonb_array_length(cards));
  assert (select array_agg((e ->> 'flow_id')::bigint order by (e ->> 'flow_id')::bigint) from jsonb_array_elements(cards) e) = array[i.alpha, i.gamma, i.practice], 'the cards are this manager''s flows only';
  assert not exists (select 1 from jsonb_array_elements(cards) e where (e ->> 'manager_member_id')::bigint is distinct from i.mgr1), 'every card names this manager';
  assert not exists (select 1 from jsonb_array_elements(cards) e where e ->> 'name' in ('Test Person Beta', 'Test Person NoManager')), 'no one else''s hire is in the list';
  assert (select e ->> 'status' from jsonb_array_elements(cards) e where (e ->> 'flow_id')::bigint = i.gamma) = 'offered', 'an offered flow is on the card list as offered';
  assert (select e ->> 'status' from jsonb_array_elements(cards) e where (e ->> 'flow_id')::bigint = i.alpha) = 'waiting', 'an accepted one as waiting';
  assert (select e -> 'default_manager' from jsonb_array_elements(cards) e where (e ->> 'flow_id')::bigint = i.alpha) = 'null'::jsonb, 'the HR-only default manager is null for a manager, not an error';

  -- the same shape as a ready list row
  select j into ready from w275_ready;
  select e into ready_row from jsonb_array_elements(ready) e where (e ->> 'flow_id')::bigint = i.alpha;
  select e into row_k from jsonb_array_elements(cards) e where (e ->> 'flow_id')::bigint = i.alpha;
  assert ready_row is not null, 'the ready list has the same flow';
  assert (select array_agg(key order by key) from jsonb_object_keys(ready_row) key) = (select array_agg(key order by key) from jsonb_object_keys(row_k) key), 'a card has exactly the keys of a ready list row';
  foreach k in array array['flow_id', 'candidate_id', 'status', 'practice', 'name', 'role', 'email', 'accepted_on', 'offer_respond_by', 'offer_start', 'late', 'grids', 'call_at', 'one_on_one_at',
                            'manager_member_id', 'default_manager', 'other_open_rows', 'offer_hours', 'proposed_call_at', 'proposed_one_on_one_at', 'hire_answer', 'manager_availability_at']
  loop
    assert row_k ? k, 'the card has ' || k;
  end loop;
  assert (row_k ->> 'offer_hours')::int = 6, 'the card says the offered hours';
  assert (row_k ->> 'proposed_call_at')::timestamptz = timestamptz '2026-12-01 15:00+00' and (row_k ->> 'proposed_one_on_one_at')::timestamptz = timestamptz '2026-12-02 15:00+00', 'the card carries the proposal';
  assert row_k ->> 'hire_answer' = 'yes' and row_k ->> 'proposed_by' = 'w275.mgr1@example.invalid', 'the card carries the answer and who proposed';
  assert row_k ->> 'role' = 'Test Role Alpha' and row_k ->> 'name' = 'Test Person Alpha', 'the card carries the hire';
  assert jsonb_typeof(row_k -> 'manager_availability_at') = 'null', 'no availability saved: manager_availability_at is null';
  assert (row_k -> 'hours_confirmed_at') <> 'null'::jsonb, 'the card shows when the hours were confirmed';
end $$;
-- the second manager sees their own, the member with no hires sees none, nobody signed in sees none
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.mgr2@example.invalid"}', true);
do $$ begin
  assert (select jsonb_array_length(public.wa275_my_cards())) = 1 and (public.wa275_my_cards() -> 0 ->> 'name') = 'Test Person Beta', 'the second manager sees only Beta';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.other@example.invalid"}', true);
do $$ begin assert public.wa275_my_cards() = '[]'::jsonb, 'a member with no hires has no cards'; end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.gone@example.invalid"}', true);
do $$ begin assert public.wa275_my_cards() = '[]'::jsonb, 'an inactive person has no cards (and a backed out flow is never listed)'; end $$;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin assert public.wa275_my_cards() = '[]'::jsonb, 'a signed-out visitor has no cards'; end $$;
-- a declined candidate's offered flow is not a card to act on
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
update public.hub_candidates set status = 'declined' where name = 'Test Person Gamma';
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.mgr1@example.invalid"}', true);
do $$ begin assert jsonb_array_length(public.wa275_my_cards()) = 2, 'a declined offer leaves the manager''s cards'; end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
update public.hub_candidates set status = 'offer' where name = 'Test Person Gamma';

-- the ready list: HR still gets what wave271 gave, plus the new fields, and offered flows are in it
do $$
declare ready jsonb; r jsonb; k text;
begin
  ready := public.wa271_ready_list();
  assert jsonb_typeof(ready) = 'array' and jsonb_array_length(ready) >= 5, 'the ready list has the flows';
  select e into r from jsonb_array_elements(ready) e where e ->> 'name' = 'Test Person Alpha';
  foreach k in array array['offer_hours', 'proposed_call_at', 'proposed_one_on_one_at', 'hire_answer', 'manager_availability_at', 'grids', 'default_manager', 'other_open_rows', 'late'] loop
    assert r ? k, 'the ready list row has ' || k;
  end loop;
  assert (r ->> 'offer_hours')::int = 6 and r ->> 'hire_answer' = 'yes', 'the new fields carry the values';
  assert exists (select 1 from jsonb_array_elements(ready) e where e ->> 'name' = 'Test Person Gamma' and e ->> 'status' = 'offered'), 'HR sees an offered flow';
  assert not exists (select 1 from jsonb_array_elements(ready) e where e ->> 'name' = 'Test Person Gone Mgr'), 'a backed out flow is not on the list';
  assert (select e -> 'default_manager' ->> 'how' from jsonb_array_elements(ready) e where e ->> 'name' = 'Test Person Alpha') = 'none', 'HR still gets the default manager';
  -- a manager with the hire's manager link is not HR: the HR list is still HR only
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.mgr1@example.invalid"}', true);
do $$
begin
  begin perform public.wa271_ready_list(); assert false, 'a plain manager must not read the HR list'; exception when raise_exception then if sqlerrm like 'Only HR%' then null; else raise; end if; end;
end $$;

-- a manager's availability date shows on the row once they saved their week on Home (wave276's hub_team_avail; amended 02/11/26)
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
do $$
declare r jsonb; i record;
begin
  select * into i from w275_ids;
  select e into r from jsonb_array_elements(public.wa271_ready_list()) e where (e ->> 'flow_id')::bigint = i.alpha;
  assert (r -> 'manager_no_week') = 'true'::jsonb and (r -> 'manager_week_stale') = 'true'::jsonb, 'no week saved: the card says so (manager_no_week, manager_week_stale)';
  insert into public.hub_team_avail (email, department, effective_from, slots, hours, updated_at)
  values ('w275.mgr1@example.invalid', 'w275test', current_date - 3, '{540,570}', 1, now() - interval '2 days');
  select e into r from jsonb_array_elements(public.wa271_ready_list()) e where (e ->> 'flow_id')::bigint = i.alpha;
  assert (r ->> 'manager_availability_at')::timestamptz = now() - interval '2 days', 'manager_availability_at is when the manager last saved their week';
  assert (r -> 'manager_no_week') = 'false'::jsonb and (r -> 'manager_week_stale') = 'false'::jsonb, 'a saved week with no ask since is current';
  delete from public.hub_team_avail where email = 'w275.mgr1@example.invalid';
end $$;

-- ---------------------------------------------------------------- hours_confirmed_at is readable by HR (on the card row) and was set
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert (select hours_confirmed_at from public.hub_candidates where name = 'Test Person Alpha') is not null, 'hours_confirmed_at was saved';
  assert (select (e ->> 'hours_confirmed_at') is not null from jsonb_array_elements(public.wa271_ready_list()) e where (e ->> 'flow_id')::bigint = i.alpha), 'HR reads hours_confirmed_at on the card';
end $$;

-- ---------------------------------------------------------------- availability validation
do $$
declare cases jsonb := '[
  {"ok": true,  "why": "null passes (no availability saved)", "v": null},
  {"ok": true,  "why": "an empty object", "v": {}},
  {"ok": true,  "why": "a normal week", "v": {"weekly": {"mon": [["09:00","12:00"],["13:00","17:00"]], "tue": [["09:00","17:00"]], "sun": []}, "tz": "America/Toronto"}},
  {"ok": true,  "why": "an except day with times", "v": {"weekly": {"mon": [["09:00","17:00"]]}, "except": [{"date": "2026-11-11", "free": [["10:00","11:30"]]}]}},
  {"ok": true,  "why": "an except day with nothing free (unavailable that day)", "v": {"weekly": {}, "except": [{"date": "2026-11-11", "free": []}]}},
  {"ok": true,  "why": "the last five minutes of the day", "v": {"weekly": {"fri": [["23:00","23:55"]]}}},
  {"ok": true,  "why": "midnight start", "v": {"weekly": {"sat": [["00:00","00:05"]]}}},
  {"ok": true,  "why": "a leap day that exists", "v": {"except": [{"date": "2028-02-29", "free": []}]}},
  {"ok": false, "why": "a block that ends before it starts", "v": {"weekly": {"mon": [["17:00","09:00"]]}}},
  {"ok": false, "why": "a block of zero length", "v": {"weekly": {"mon": [["09:00","09:00"]]}}},
  {"ok": false, "why": "a start not on a 5-minute mark", "v": {"weekly": {"mon": [["09:03","12:00"]]}}},
  {"ok": false, "why": "an end not on a 5-minute mark", "v": {"weekly": {"mon": [["09:00","12:07"]]}}},
  {"ok": false, "why": "a weekend key spelled out", "v": {"weekly": {"monday": [["09:00","12:00"]]}}},
  {"ok": false, "why": "a capital key", "v": {"weekly": {"Mon": [["09:00","12:00"]]}}},
  {"ok": false, "why": "a numeric weekday key", "v": {"weekly": {"1": [["09:00","12:00"]]}}},
  {"ok": false, "why": "24:00", "v": {"weekly": {"mon": [["09:00","24:00"]]}}},
  {"ok": false, "why": "an hour past 23", "v": {"weekly": {"mon": [["09:00","25:00"]]}}},
  {"ok": false, "why": "minutes past 59", "v": {"weekly": {"mon": [["09:60","10:00"]]}}},
  {"ok": false, "why": "a time without the leading zero", "v": {"weekly": {"mon": [["9:00","12:00"]]}}},
  {"ok": false, "why": "a time with seconds", "v": {"weekly": {"mon": [["09:00:00","12:00"]]}}},
  {"ok": false, "why": "a block with three parts", "v": {"weekly": {"mon": [["09:00","12:00","13:00"]]}}},
  {"ok": false, "why": "a block with one part", "v": {"weekly": {"mon": [["09:00"]]}}},
  {"ok": false, "why": "a block that is a string", "v": {"weekly": {"mon": ["09:00-12:00"]}}},
  {"ok": false, "why": "numbers for times", "v": {"weekly": {"mon": [[9, 12]]}}},
  {"ok": false, "why": "a day that is not a list", "v": {"weekly": {"mon": "09:00-17:00"}}},
  {"ok": false, "why": "weekly that is a list", "v": {"weekly": []}},
  {"ok": false, "why": "a wrong time zone", "v": {"weekly": {"mon": [["09:00","12:00"]]}, "tz": "America/Vancouver"}},
  {"ok": false, "why": "a time zone that is not text", "v": {"tz": 5}},
  {"ok": false, "why": "an unknown top level key", "v": {"weekly": {}, "holidays": []}},
  {"ok": false, "why": "an except date that is not a date", "v": {"except": [{"date": "2026-13-01", "free": []}]}},
  {"ok": false, "why": "an except date that does not exist", "v": {"except": [{"date": "2026-02-30", "free": []}]}},
  {"ok": false, "why": "a leap day in a year without one", "v": {"except": [{"date": "2027-02-29", "free": []}]}},
  {"ok": false, "why": "an except date in the wrong format", "v": {"except": [{"date": "11/11/2026", "free": []}]}},
  {"ok": false, "why": "an except date without the day padded", "v": {"except": [{"date": "2026-1-5", "free": []}]}},
  {"ok": false, "why": "an except entry without free", "v": {"except": [{"date": "2026-11-11"}]}},
  {"ok": false, "why": "an except entry without a date", "v": {"except": [{"free": []}]}},
  {"ok": false, "why": "an except entry with an extra key", "v": {"except": [{"date": "2026-11-11", "free": [], "note": "x"}]}},
  {"ok": false, "why": "an except free block that ends before it starts", "v": {"except": [{"date": "2026-11-11", "free": [["12:00","10:00"]]}]}},
  {"ok": false, "why": "an except free block off the 5-minute marks", "v": {"except": [{"date": "2026-11-11", "free": [["10:01","11:00"]]}]}},
  {"ok": false, "why": "except that is an object", "v": {"except": {"date": "2026-11-11"}}},
  {"ok": false, "why": "an except entry that is not an object", "v": {"except": ["2026-11-11"]}},
  {"ok": false, "why": "an array", "v": [["09:00","17:00"]]},
  {"ok": false, "why": "a string", "v": "Monday to Friday"},
  {"ok": false, "why": "a number", "v": 7},
  {"ok": false, "why": "json null", "v": "JSONNULL"}
]'::jsonb; c jsonb; got boolean; v jsonb;
begin
  for c in select * from jsonb_array_elements(cases) loop
    v := c -> 'v';
    if v = 'null'::jsonb then v := null;                       -- the first case: SQL null (nothing saved)
    elsif v = '"JSONNULL"'::jsonb then v := 'null'::jsonb;     -- the last case: a stored json null, which is refused
    end if;
    got := public.wa275_availability_ok(v);
    assert got is not null, 'never null: ' || (c ->> 'why');
    assert got = (c ->> 'ok')::boolean, format('availability_ok(%s): %s should be %s', v, c ->> 'why', c ->> 'ok');
  end loop;
end $$;

-- the same rule as a check constraint on team_members.availability, for the browser's own role too (a check runs as the writer)
do $$
begin
  assert exists (select 1 from pg_constraint where conrelid = 'public.team_members'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%wa275_availability_ok%'), 'the check constraint is on team_members';
  begin
    update public.team_members set availability = '{"weekly":{"mon":[["17:00","09:00"]]}}'::jsonb where email = 'w275.other@example.invalid';
    assert false, 'a bad availability should be refused by the table';
  exception when check_violation then null; end;
  begin
    insert into public.team_members (name, email, availability) values ('Test Person Bad Insert', 'w275.badinsert@example.invalid', '{"weekly":{"funday":[]}}'::jsonb);
    assert false, 'a bad availability should be refused on insert';
  exception when check_violation then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.other@example.invalid"}', true);
do $$
begin
  -- an ordinary roster edit by a signed-in role still works with the check in place (other columns, and a good availability)
  update public.team_members set role = 'Analyst II' where email = 'w275.other@example.invalid';
  update public.team_members set availability = '{"weekly":{"tue":[["10:00","11:00"]]}}'::jsonb where email = 'w275.other@example.invalid';
  assert (select role from public.team_members where email = 'w275.other@example.invalid') = 'Analyst II', 'a roster edit by a signed-in role works with the check constraint';
end $$;
reset role;
update public.team_members set availability = null, availability_at = null where email = 'w275.other@example.invalid';

-- ---------------------------------------------------------------- setting and reading availability
-- Amended 02/11/26 (Steel): the week is wave276's typical week (hub_team_avail, saved on Home); team_members.availability keeps only one-off dates
-- (except) and tz. A slot is weekday * 1440 + minute (weekday 0 = Monday, Toronto wall time), a cell avail_cell_min (30) minutes.
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.other@example.invalid"}', true);
do $$
declare mid bigint; r jsonb; saved timestamptz;
begin
  select id into mid from public.team_members where email = 'w275.other@example.invalid';

  -- nothing saved: the default, no week, stale
  r := public.wa275_availability_of(mid);
  assert (r ->> 'stale')::boolean, 'nothing saved is stale';
  assert (r ->> 'no_week')::boolean, 'nothing saved: no_week';
  assert r -> 'availability' -> 'weekly' -> 'mon' = '[["09:00","17:00"]]'::jsonb and r -> 'availability' -> 'weekly' -> 'fri' = '[["09:00","17:00"]]'::jsonb, 'the default is Monday to Friday 09:00 to 17:00';
  assert not (r -> 'availability' -> 'weekly' ? 'sat') or r -> 'availability' -> 'weekly' -> 'sat' = '[]'::jsonb, 'the default has no weekend';
  assert not (r -> 'availability' -> 'weekly' ? 'sun') or r -> 'availability' -> 'weekly' -> 'sun' = '[]'::jsonb, 'the default has no Sunday';
  assert r -> 'availability' ->> 'tz' = 'America/Toronto', 'the default is in Toronto time';
  assert r -> 'availability' -> 'except' = '[]'::jsonb, 'no one-off dates';
  assert public.wa275_availability_ok(r -> 'availability'), 'the default passes the check';
  assert jsonb_typeof(r -> 'availability_at') = 'null', 'no time saved for the default';

  -- the week saved on Home: the current row is the newest effective_from on or before today, with a save time; its cells joined into blocks
  saved := now() - interval '5 days';
  insert into public.hub_team_avail (email, department, effective_from, slots, hours, updated_at) values
    ('W275.Other@Example.Invalid', 'w275test', current_date - 10, '{540,570,600,840,3660,3690,9240}', 3.5, saved),     -- Mon 09:00 to 10:30 and 14:00 to 14:30, Wed 13:00 to 14:00, Sun 10:00 to 10:30
    ('w275.other@example.invalid', 'w275test', current_date - 40, '{1500,1530}', 1, now() - interval '40 days'),     -- an older week: not current
    ('w275.other@example.invalid', 'w275test', current_date + 5, '{2000}', 0.5, now() - interval '20 days'),         -- a week that starts later waits for its day
    ('w275.other@example.invalid', 'w275test', current_date, '{}', 0, null);                                          -- an Ask me later row only (no save time): not an answer
  r := public.wa275_availability_of(mid);
  assert not (r ->> 'no_week')::boolean, 'a saved week is a week';
  assert not (r ->> 'stale')::boolean, 'a week saved with no ask since is current';
  assert r -> 'availability' -> 'weekly' -> 'mon' = '[["09:00","10:30"],["14:00","14:30"]]'::jsonb, format('Monday is two blocks, cells joined, each ending at its last cell''s end: %s', r -> 'availability' -> 'weekly');
  assert r -> 'availability' -> 'weekly' -> 'wed' = '[["13:00","14:00"]]'::jsonb, 'Wednesday';
  assert r -> 'availability' -> 'weekly' -> 'sun' = '[["10:00","10:30"]]'::jsonb, 'Sunday is weekday 6';
  assert not (r -> 'availability' -> 'weekly' ? 'tue') and not (r -> 'availability' -> 'weekly' ? 'thu'), 'the older week and the later week are not used';
  assert (r ->> 'availability_at')::timestamptz = saved, 'availability_at is when the current week was saved';
  assert public.wa275_availability_ok(r -> 'availability'), 'the derived week passes the check';

  -- the union of their teams: a Monday 10:30 to 11:00 cell on a second team joins the 09:00 block
  insert into public.hub_team_avail (email, department, effective_from, slots, hours, updated_at) values ('w275.other@example.invalid', 'w275two', current_date - 1, '{630}', 0.5, now() - interval '1 day');
  r := public.wa275_availability_of(mid);
  assert r -> 'availability' -> 'weekly' -> 'mon' = '[["09:00","11:00"],["14:00","14:30"]]'::jsonb, format('the teams'' weeks are joined: %s', r -> 'availability' -> 'weekly' -> 'mon');
  assert (r ->> 'availability_at')::timestamptz = now() - interval '1 day', 'availability_at is the newest save of the current weeks';

  -- current means saved on or after the latest ask (on or before today) for any of their teams, as wave276's pop-up counts it
  insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('w275test', current_date - 2, 'w275 test');
  assert not (public.wa275_availability_of(mid) ->> 'stale')::boolean, 'one team asked again, the other team''s week is current: not stale';
  insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('w275two', current_date, 'w275 test');
  assert (public.wa275_availability_of(mid) ->> 'stale')::boolean, 'both teams asked since the last saves: stale';
  assert public.wa275_availability_of(mid) -> 'availability' -> 'weekly' -> 'mon' = '[["09:00","11:00"],["14:00","14:30"]]'::jsonb, 'a stale week is still the week used';
  update public.hub_team_avail set updated_at = now() where email = 'w275.other@example.invalid' and department = 'w275two' and effective_from = current_date - 1;
  assert not (public.wa275_availability_of(mid) ->> 'stale')::boolean, 'saved again on the ask day: current';
  insert into public.hub_team_avail_ask (department, ask_date, set_by) values ('w275two', current_date + 3, 'w275 test'), ('w275test', current_date + 3, 'w275 test');
  assert not (public.wa275_availability_of(mid) ->> 'stale')::boolean, 'an ask dated later does not count yet';

  -- the cell length is app_config avail_cell_min
  update public.app_config set value = '60' where key = 'avail_cell_min';
  assert public.wa275_availability_of(mid) -> 'availability' -> 'weekly' -> 'wed' = '[["13:00","14:30"]]'::jsonb, format('with 60-minute cells, 13:00 and 13:30 each last an hour, joined where they overlap: %s', public.wa275_availability_of(mid) -> 'availability' -> 'weekly');
  update public.app_config set value = '30' where key = 'avail_cell_min';

  -- an empty saved week counts as no week (the default applies, and the person is asked to set it)
  delete from public.hub_team_avail where email = 'w275.other@example.invalid' and department = 'w275two';
  update public.hub_team_avail set slots = '{}' where lower(email) = 'w275.other@example.invalid' and effective_from = current_date - 10;
  r := public.wa275_availability_of(mid);
  assert (r ->> 'no_week')::boolean and r -> 'availability' -> 'weekly' -> 'mon' = '[["09:00","17:00"]]'::jsonb, 'an empty week: the default, no_week';
  update public.hub_team_avail set slots = '{540,570,600,840,3660,3690,9240}' where lower(email) = 'w275.other@example.invalid' and effective_from = current_date - 10;

  -- one-off dates are the person's own, on the roster row; a weekly key there is refused, and an old one is never read
  perform public.wa275_availability_set('{"except":[{"date":"2026-11-11","free":[]},{"date":"2026-11-12","free":[["18:00","20:00"]]}],"tz":"America/Toronto"}'::jsonb);
  r := public.wa275_availability_of(mid);
  assert r -> 'availability' -> 'except' -> 0 ->> 'date' = '2026-11-11' and r -> 'availability' -> 'except' -> 1 -> 'free' = '[["18:00","20:00"]]'::jsonb, 'the one-off dates come back';
  assert r -> 'availability' -> 'weekly' -> 'mon' = '[["09:00","10:30"],["14:00","14:30"]]'::jsonb, 'and the week is still the saved one';
  assert (select availability_at from public.team_members where id = mid) = now(), 'availability_at on the roster row was stamped (this transaction''s time)';
  assert (r ->> 'except_at')::timestamptz = now(), 'and returned as except_at';
  assert (r ->> 'availability_at')::timestamptz = saved, 'availability_at stays the week''s save time';
  assert not ((select availability from public.team_members where id = mid) ? 'weekly'), 'no weekly is stored';
  begin perform public.wa275_availability_set('{"weekly":{"mon":[["10:00","12:00"]]},"except":[]}'::jsonb); assert false, 'a weekly key should be refused';
  exception when raise_exception then if sqlerrm like 'Your typical week is set on the Hub''s Home page%' then null; else raise; end if; end;
  begin perform public.wa275_availability_set('{"except":[{"date":"2026-11-11","free":[["12:00","10:00"]]}]}'::jsonb); assert false, 'bad availability should be refused';
  exception when raise_exception then if sqlerrm like 'That availability is not valid%' then null; else raise; end if; end;
  begin perform public.wa275_availability_set(null); assert false, 'null should be refused';
  exception when raise_exception then if sqlerrm like 'That availability is not valid%' then null; else raise; end if; end;
  begin perform public.wa275_availability_set('[]'::jsonb); assert false, 'a list should be refused';
  exception when raise_exception then if sqlerrm like 'That availability is not valid%' then null; else raise; end if; end;
  assert jsonb_array_length(public.wa275_availability_of(mid) -> 'availability' -> 'except') = 2, 'a refused save changed nothing';
  update public.team_members set availability = '{"weekly":{"tue":[["06:00","07:00"]]},"except":[]}'::jsonb where id = mid;   -- an older value written straight to the column
  assert not (public.wa275_availability_of(mid) -> 'availability' -> 'weekly' ? 'tue'), 'a weekly left in the column is never read';
  update public.team_members set availability = null, availability_at = null where id = mid;
  delete from public.hub_team_avail where lower(email) = 'w275.other@example.invalid';
  delete from public.hub_team_avail_ask where set_by = 'w275 test';
end $$;

-- who may read someone's availability
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.mgr1@example.invalid"}', true);
do $$
declare other bigint;
begin
  select id into other from public.team_members where email = 'w275.other@example.invalid';
  begin perform public.wa275_availability_of(other); assert false, 'another member must not read it';
  exception when raise_exception then if sqlerrm like 'Only HR%' then null; else raise; end if; end;
  assert (public.wa275_availability_of((select id from public.team_members where email = 'w275.mgr1@example.invalid')) ->> 'stale') is not null, 'the person can read their own';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
do $$ begin assert public.wa275_availability_of((select id from public.team_members where email = 'w275.other@example.invalid')) is not null, 'HR can read anyone''s'; end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.admin@example.invalid"}', true);
do $$ begin assert public.wa275_availability_of((select id from public.team_members where email = 'w275.other@example.invalid')) is not null, 'an admin can read anyone''s'; end $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ begin assert public.wa275_availability_of((select id from public.team_members where email = 'w275.other@example.invalid')) is not null, 'the service key can read anyone''s';
  begin perform public.wa275_availability_of(-1); assert false, 'a person who is not on the roster';
  exception when raise_exception then if sqlerrm like 'That person%' then null; else raise; end if; end;
end $$;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin perform public.wa275_availability_of((select id from public.team_members where email = 'w275.other@example.invalid')); assert false, 'a signed-out visitor must not read it';
  exception when raise_exception then if sqlerrm like 'Only HR%' then null; else raise; end if; end;
  begin perform public.wa275_availability_set('{}'::jsonb); assert false, 'a signed-out visitor must not set it';
  exception when raise_exception then if sqlerrm like 'Sign in%' then null; else raise; end if; end;
end $$;
-- someone signed in who is not on the roster has no availability to set
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.nobody@example.invalid"}', true);
do $$
begin
  begin perform public.wa275_availability_set('{}'::jsonb); assert false, 'a person not on the roster has nothing to set';
  exception when raise_exception then if sqlerrm like 'Sign in%' or sqlerrm like 'Only people on the team%' then null; else raise; end if; end;
end $$;

-- ---------------------------------------------------------------- as the browser's own role: the chain of definer functions works without direct rights to the internal ones
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.mgr1@example.invalid"}', true);
set local role authenticated;
do $$
declare i record;
begin
  select * into i from w275_ids;
  assert jsonb_array_length(public.wa275_my_cards()) = 3, 'as the signed-in role, a manager reads their cards';
  assert public.wa275_manager_of(i.alpha) and not public.wa275_manager_of(i.beta), 'as the signed-in role, manager_of answers';
  begin perform public.wa275_flow_row(i.alpha); assert false, 'flow_row must not be callable by the browser role';
  exception when insufficient_privilege then null; end;
  begin perform public.wa275_offer_sent(); assert false, 'the trigger function must not be callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.hr@example.invalid"}', true);
set local role authenticated;
do $$
begin
  assert jsonb_array_length(public.wa271_ready_list()) >= 5, 'as the signed-in role, HR reads the list';
  assert (select count(*) from public.hub_onboard_flows) >= 5, 'HR reads the flows table (the new columns included)';
  assert (select count(*) from public.hub_onboard_flows where hire_answer = 'yes') = 1, 'and filters on the new columns';
end $$;
reset role;
-- why wa275_availability_ok is open to the browser role: a check constraint runs with the rights of the writer
revoke execute on function public.wa275_availability_ok(jsonb) from authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w275.other@example.invalid"}', true);
set local role authenticated;
do $$
begin
  begin update public.team_members set role = 'Analyst III' where email = 'w275.other@example.invalid'; assert false, 'without the grant, every roster edit would fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
grant execute on function public.wa275_availability_ok(jsonb) to authenticated;

-- wa275_tick_set (fix round 1): one key merged, a claim that wins once, the service key only
do $$
begin
  assert has_function_privilege('service_role', 'public.wa275_tick_set(bigint, text, jsonb, boolean)', 'execute'), 'the service key may set a tick';
  assert not has_function_privilege('authenticated', 'public.wa275_tick_set(bigint, text, jsonb, boolean)', 'execute') and not has_function_privilege('anon', 'public.wa275_tick_set(bigint, text, jsonb, boolean)', 'execute'), 'the browser may not';
  assert obj_description('public.wa275_tick_set(bigint, text, jsonb, boolean)'::regprocedure, 'pg_proc') is not null, 'tick_set is commented';
end $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare f bigint;
begin
  select min(id) into f from public.hub_onboard_flows;
  update public.hub_onboard_flows set setup_ticks = '{"gmail": true}' where id = f;
  assert public.wa275_tick_set(f, 'hire_times_at', '"2026-11-02T12:00:00Z"'::jsonb, true), 'the first claim wins';
  assert not public.wa275_tick_set(f, 'hire_times_at', '"2026-11-02T12:05:00Z"'::jsonb, true), 'a second claim loses';
  assert (select setup_ticks from public.hub_onboard_flows where id = f) = '{"gmail": true, "hire_times_at": "2026-11-02T12:00:00Z"}'::jsonb, 'merged: the other tick stays, the first claim stands';
  assert public.wa275_tick_set(f, 'hire_times_at', 'null'::jsonb), 'clearing the key';
  assert public.wa275_tick_set(f, 'hire_times_at', '"2026-11-02T13:00:00Z"'::jsonb, true), 'a cleared key can be claimed again';
  assert public.wa275_tick_set(f, 'hire_times_at', null), 'an SQL null clears it too';
  assert (select setup_ticks ->> 'hire_times_at' from public.hub_onboard_flows where id = f) is null, 'cleared';
  assert (select setup_ticks ->> 'gmail' from public.hub_onboard_flows where id = f) = 'true', 'the other tick is never touched';
  assert not public.wa275_tick_set(-1, 'hire_times_at', 'null'::jsonb), 'no such flow: false';
  begin perform public.wa275_tick_set(f, 'Bad Key', 'null'::jsonb); assert false, 'a bad key is refused';
  exception when raise_exception then null; end;
end $$;

-- wa275_plan_assign (Task 3): the plan the hire's Yes makes, with no sign-in; the service key only, and the same plan as onboarding_assign
do $$
begin
  assert has_function_privilege('service_role', 'public.wa275_plan_assign(bigint, text, date)', 'execute'), 'the service key may make the plan';
  assert not has_function_privilege('authenticated', 'public.wa275_plan_assign(bigint, text, date)', 'execute') and not has_function_privilege('anon', 'public.wa275_plan_assign(bigint, text, date)', 'execute'), 'the browser may not: it has no staff check';
  assert obj_description('public.wa275_plan_assign(bigint, text, date)'::regprocedure, 'pg_proc') is not null, 'plan_assign is commented';
end $$;
do $$
declare m bigint; o bigint;
begin
  select id into m from public.team_members where email = 'w275.other@example.invalid';
  o := public.wa275_plan_assign(m, 'hub (the new hire said yes)', date '2026-11-09');
  assert (select started_at from public.onboardings where id = o) = date '2026-11-09', 'day one is the date given';
  assert (select person_name from public.onboardings where id = o) = 'Test Other Member', 'named from the roster';
  assert (select assigned_by from public.onboardings where id = o) = 'hub (the new hire said yes)', 'by is stored as given';
  assert (select count(*) from public.onboarding_steps where onboarding_id = o) = (select count(*) from public.onboarding_template where active), 'every active onboarding step';
  assert (select count(*) from public.hr_setup_steps where onboarding_id = o) = (select count(*) from public.hr_setup_template where active), 'every active HR setup step';
  assert not exists (select 1 from public.onboarding_steps s join public.onboarding_template t on t.id = s.template_id where s.onboarding_id = o and s.due_date is distinct from public.onb_due(t.section, date '2026-11-09')), 'due dates count from day one';
  begin perform public.wa275_plan_assign(m, 'x', null); assert false, 'no day one is refused';
  exception when raise_exception then null; end;
  begin perform public.wa275_plan_assign(-1, 'x', date '2026-11-09'); assert false, 'someone not on the roster is refused';
  exception when raise_exception then null; end;
end $$;

select 'w275sql: all assertions passed' as result;
rollback;

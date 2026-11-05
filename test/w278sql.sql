-- Welfare Avenue Hub: wave278 (278a), Task 1. Assertions for build/wa278a_onboarding.sql.
-- Assumes wave271 (a, b, c, d), wave275 (a, b) and wave278a are already loaded. Everything runs in one transaction and ends with a rollback; any failed
-- assertion raises. Offline: node test/w271sql.mjs (PGlite, with test/w271schema.sql). On live, only at the release gate and only with Steel's yes: paste this
-- file into execute_sql once the migration has been applied; afterwards the test rows are gone.
-- The tick carry-over is a one-time update inside the migration, so its cases are proved by test/w271sql.mjs (rows put in before the file is applied).
-- Every row is invented (Test Person, example.invalid), except the one signed-in address the plan names (hire@welfareavenue.com), used only inside this
-- transaction. Fixtures sit in the department code w278test so no real team is touched.

begin;

-- ---------------------------------------------------------------- fixtures
insert into public.team_members (name, email, department, role) values
  ('Test Recruiter One', 'W278.Recruiter1@Example.Invalid', 'w278test', 'Coordinator'),
  ('Test Recruiter Two', 'w278.recruiter2@example.invalid', 'w278test', 'Coordinator');
insert into public.wa_hr_access (email) values ('w278.hr@example.invalid');
insert into public.hub_candidates (name, email, status, offer_hours, owner, role) values
  ('Test Person W278 Hire', 'w278.hire.personal@example.invalid', 'offer', 6, 'Test Recruiter One', 'Test Role Hire'),
  ('Test Person W278 Other', 'w278.other.personal@example.invalid', 'offer', 6, 'w278.recruiter2@example.invalid', 'Test Role Other'),
  ('Test Person W278 Unknown', 'w278.unknown.personal@example.invalid', 'offer', 6, 'Nobody By This Name', 'Test Role Unknown'),
  ('Test Person W278 None', 'w278.none.personal@example.invalid', 'offer', 6, null, 'Test Role None');
update public.hub_candidates set offer_sent_at = now() where email like 'w278.%.personal@example.invalid';
update public.hub_onboard_flows f set wa_email = case c.name when 'Test Person W278 Hire' then 'hire@welfareavenue.com' when 'Test Person W278 Other' then 'w278.other@example.invalid' end
  from public.hub_candidates c where c.id = f.candidate_id and c.email like 'w278.%.personal@example.invalid';
create temp table w278_ids on commit drop as
  select (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person W278 Hire') as hire,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person W278 Other') as other,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person W278 Unknown') as unknown,
         (select f.id from public.hub_onboard_flows f join public.hub_candidates c on c.id = f.candidate_id where c.name = 'Test Person W278 None') as none;

select set_config('request.jwt.claims', '{"role":"authenticated","email":"w278.hr@example.invalid"}', true);

-- ---------------------------------------------------------------- the columns, with their defaults and comments
do $$
begin
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_candidates' and column_name = 'offer_sent_by' and data_type = 'text' and column_default is null),
    'hub_candidates.offer_sent_by is a text column with no default';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'leader' and data_type = 'boolean' and is_nullable = 'YES' and column_default is null),
    'hub_onboard_flows.leader is a boolean, null until decided';
  assert exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hub_onboard_flows' and column_name = 'welcome_cc' and data_type = 'ARRAY' and udt_name = '_text' and is_nullable = 'NO' and column_default like '''{}''%'),
    'hub_onboard_flows.welcome_cc is a text array, not null, default {}';
  assert col_description('public.hub_candidates'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_candidates'::regclass and attname = 'offer_sent_by')) like '%recruit-actions%', 'offer_sent_by is commented (who writes it)';
  assert col_description('public.hub_onboard_flows'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_onboard_flows'::regclass and attname = 'leader')) like '%onboard_leader_titles%', 'leader is commented (the rule it comes from)';
  assert col_description('public.hub_onboard_flows'::regclass, (select attnum from pg_attribute where attrelid = 'public.hub_onboard_flows'::regclass and attname = 'welcome_cc')) like '%card%', 'welcome_cc is commented (who sets it)';
  assert has_column_privilege('authenticated', 'public.hub_onboard_flows', 'leader', 'select') and has_column_privilege('authenticated', 'public.hub_onboard_flows', 'welcome_cc', 'select'),
    'the signed-in role may read the two new flow columns (as every column but pw_nonce; row security keeps it to HR and admins)';
  assert not has_column_privilege('authenticated', 'public.hub_onboard_flows', 'pw_nonce', 'select'), 'pw_nonce is still left out';
  assert not has_column_privilege('anon', 'public.hub_onboard_flows', 'leader', 'select'), 'nobody signed out reads them';
  -- a new flow starts with the decision open and no copies
  assert (select leader is null and welcome_cc = '{}'::text[] from public.hub_onboard_flows where id = (select hire from w278_ids)), 'a new flow: leader not decided, no welcome copies';
end $$;

-- ---------------------------------------------------------------- the settings (HR can change them)
do $$
declare g jsonb; d jsonb; k text;
begin
  foreach k in array array['onboard_auto_groups', 'onboard_auto_drives', 'onboard_auto_meeting', 'onboard_auto_channel'] loop
    assert (select value from public.app_config where key = k) = 'on', k || ' ships on';
  end loop;
  assert (select value from public.app_config where key = 'onboard_leader_titles') = 'director, lead, head, chief, manager', 'onboard_leader_titles is the five words';
  g := (select value::jsonb from public.app_config where key = 'onboard_groups');
  assert g -> 'by_department' -> 'fundraising' ? 'grants@welfareavenue.com', 'onboard_groups parses and fundraising holds grants@';
  assert g = '{"all": ["org@welfareavenue.com"], "leaders": ["admin@welfareavenue.com", "directors@welfareavenue.com"], "by_department": {"marketing": ["marketing@welfareavenue.com"], "fundraising": ["fundraising@welfareavenue.com", "grants@welfareavenue.com"], "opsmtl": ["operations@welfareavenue.com"], "opsto": ["operations@welfareavenue.com", "toronto@welfareavenue.com"], "outreach": ["outreach@welfareavenue.com"], "hr": ["job@welfareavenue.com"], "finance": ["finance@welfareavenue.com"], "progdev": []}}'::jsonb,
    'onboard_groups is the plan''s rule, exactly';
  d := (select value::jsonb from public.app_config where key = 'onboard_drives');
  assert d = '{"all": ["<fill at release>"], "leaders_all_except": ["<fill at release>", "<fill at release>"], "by_department": {"marketing": ["<fill at release>"], "fundraising": ["<fill at release>"], "opsmtl": ["<fill at release>"], "opsto": ["<fill at release>", "<fill at release>"], "hr": ["<fill at release>"], "progdev": ["<fill at release>"], "finance": ["<fill at release>"]}}'::jsonb,
    'onboard_drives is the plan''s shape, every id the placeholder until release';
  assert (select value::jsonb from public.app_config where key = 'onboard_weekly_meetings') = '{}'::jsonb, 'onboard_weekly_meetings is {} until release';
  assert (select value from public.app_config where key = 'onboard_slack_channel_link') = 'https://join.slack.com/share/enQtMTI1MDM3NDg0MjE0NDQtMDUyMjMzYjY0ZDY5MDUyMjI2NzMzNTg5N2VlYTgzMjExYjU2MjUzMjdkZmVlMDk0Yzg2ODliY2QwYTg2ZWU2NQ', 'onboard_slack_channel_link is the plan''s link';
  assert (select value from public.app_config where key = 'onboard_slack_channel_id') = '', 'onboard_slack_channel_id is empty until HR pastes it';
  assert (select value from public.app_config where key = 'onboard_setup_video') = '', 'onboard_setup_video is empty until Steel records it';
end $$;

-- ---------------------------------------------------------------- the card row: the four new fields (the rest is as wave275b gives it)
do $$
declare i record; r jsonb;
begin
  select * into i from w278_ids;
  update public.hub_candidates set offer_sent_by = 'w278.sender@example.invalid' where name = 'Test Person W278 Hire';
  update public.hub_onboard_flows set leader = true, welcome_cc = array['w278.copy1@example.invalid', 'w278.copy2@example.invalid'] where id = i.hire;
  r := public.wa275_flow_row(i.hire);
  assert r -> 'leader' = 'true'::jsonb, 'flow_row: leader';
  assert r -> 'welcome_cc' = '["w278.copy1@example.invalid", "w278.copy2@example.invalid"]'::jsonb, 'flow_row: welcome_cc as a json array';
  assert r ->> 'offer_sent_by' = 'w278.sender@example.invalid', 'flow_row: offer_sent_by';
  assert r ->> 'owner_email' = 'w278.recruiter1@example.invalid', format('flow_row: owner_email from the owner''s name on the roster, lower case (got %s)', r ->> 'owner_email');
  -- the owner given as an email (any case) is that email; a name with no roster match and no owner are null
  assert public.wa275_flow_row(i.other) ->> 'owner_email' = 'w278.recruiter2@example.invalid', 'flow_row: an owner given as an email';
  update public.hub_candidates set owner = ' W278.RECRUITER2@example.invalid ' where name = 'Test Person W278 Other';
  assert public.wa275_flow_row(i.other) ->> 'owner_email' = 'w278.recruiter2@example.invalid', 'flow_row: an owner email in another case, with spaces';
  update public.hub_candidates set owner = 'test recruiter two' where name = 'Test Person W278 Other';
  assert public.wa275_flow_row(i.other) ->> 'owner_email' = 'w278.recruiter2@example.invalid', 'flow_row: an owner name in another case';
  assert public.wa275_flow_row(i.unknown) ? 'owner_email' and public.wa275_flow_row(i.unknown) -> 'owner_email' = 'null'::jsonb, 'flow_row: an owner name with no roster match is null';
  assert public.wa275_flow_row(i.none) -> 'owner_email' = 'null'::jsonb, 'flow_row: no owner is null';
  -- an owner whose name is on the roster twice: the active row wins
  update public.team_members set active = false where name = 'Test Recruiter One';
  insert into public.team_members (name, email, department) values ('Test Recruiter One', 'w278.recruiter1.new@example.invalid', 'w278test');
  assert public.wa275_flow_row(i.hire) ->> 'owner_email' = 'w278.recruiter1.new@example.invalid', 'flow_row: of two roster rows with the owner''s name, the active one';
  -- an undecided flow
  r := public.wa275_flow_row(i.none);
  assert r ? 'leader' and r -> 'leader' = 'null'::jsonb and r -> 'welcome_cc' = '[]'::jsonb and r -> 'offer_sent_by' = 'null'::jsonb, 'flow_row: an undecided flow has leader null, no copies, no sender';
  -- what wave275b gave is still there
  assert r ? 'manager_hours' and r ? 'steps' and r ? 'setup_ticks' and r ? 'propose_path' and r ? 'manager_no_week' and r ->> 'status' = 'offered', 'flow_row: the wave275b fields are still there';
  -- and its safety: definer, search_path '', not callable from the browser, commented with the new fields
  assert (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.wa275_flow_row(bigint)'::regprocedure), 'flow_row is a definer with an empty search_path';
  assert not has_function_privilege('authenticated', 'public.wa275_flow_row(bigint)', 'execute') and not has_function_privilege('anon', 'public.wa275_flow_row(bigint)', 'execute'), 'flow_row is not callable from the browser';
  assert obj_description('public.wa275_flow_row(bigint)'::regprocedure, 'pg_proc') like '%owner_email%' and obj_description('public.wa275_flow_row(bigint)'::regprocedure, 'pg_proc') like '%manager_hours%', 'flow_row comment names the new fields and keeps manager_hours';
  -- the HR list carries the new fields (it is built from the row)
  assert (select bool_and(e ? 'leader' and e ? 'welcome_cc' and e ? 'offer_sent_by' and e ? 'owner_email') from jsonb_array_elements(public.wa271_ready_list()) e), 'the Ready list rows carry the four new fields';
end $$;

-- ---------------------------------------------------------------- wa278_hub_seen(): the Hub page ticks rd_hub when the hire signs in
do $$
begin
  assert (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.wa278_hub_seen()'::regprocedure), 'hub_seen is a definer with an empty search_path';
  assert (select prorettype = 'boolean'::regtype from pg_proc where oid = 'public.wa278_hub_seen()'::regprocedure), 'hub_seen returns a boolean';
  assert has_function_privilege('authenticated', 'public.wa278_hub_seen()', 'execute'), 'the signed-in role may call hub_seen';
  assert not has_function_privilege('anon', 'public.wa278_hub_seen()', 'execute'), 'nobody signed out may';
  assert not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.wa278_hub_seen()'::regprocedure and a.grantee = 0), 'not granted to public';
  assert obj_description('public.wa278_hub_seen()'::regprocedure, 'pg_proc') like '%rd_hub%', 'hub_seen is commented';
end $$;
update public.hub_onboard_flows set setup_ticks = '{"rd_google": "2026-11-03T10:00:00.000Z"}' where id = (select hire from w278_ids);
-- someone else signed in: nothing ticked
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w278.someone@example.invalid"}', true);
set local role authenticated;
do $$
begin
  assert public.wa278_hub_seen() = false, 'another email: false';
end $$;
reset role;
do $$
begin
  assert not exists (select 1 from public.hub_onboard_flows f, w278_ids i where f.id in (i.hire, i.other) and f.setup_ticks ? 'rd_hub'), 'another email ticks nothing';
end $$;
-- signed in with no email: nothing
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
do $$ begin assert public.wa278_hub_seen() = false, 'no email: false'; end $$;
reset role;
-- the hire signs in (the case of the email does not matter): rd_hub ticked once, the other ticks kept, the other hire's flow untouched
select set_config('request.jwt.claims', '{"role":"authenticated","email":"Hire@WelfareAvenue.com"}', true);
set local role authenticated;
do $$
begin
  assert public.wa278_hub_seen() = true, 'the hire signs in: true';
end $$;
reset role;
create temp table w278_first on commit drop as select setup_ticks ->> 'rd_hub' as t from public.hub_onboard_flows where id = (select hire from w278_ids);
do $$
declare t text;
begin
  select setup_ticks ->> 'rd_hub' into t from public.hub_onboard_flows where id = (select hire from w278_ids);
  assert t ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$', format('rd_hub holds the time, as the page''s ticks do (got %s)', t);
  assert (select setup_ticks ->> 'rd_google' from public.hub_onboard_flows where id = (select hire from w278_ids)) = '2026-11-03T10:00:00.000Z', 'the other ticks are kept';
  assert (select setup_ticks = '{}'::jsonb from public.hub_onboard_flows where id = (select other from w278_ids)), 'the other hire''s flow is untouched';
end $$;
set local role authenticated;
do $$
begin
  assert public.wa278_hub_seen() = false, 'the second sign-in: false';
end $$;
reset role;
do $$
begin
  assert (select setup_ticks ->> 'rd_hub' from public.hub_onboard_flows where id = (select hire from w278_ids)) = (select t from w278_first), 'the second sign-in keeps the first time';
end $$;
-- a cleared tick (json null) counts as unset: the next sign-in ticks it again
update public.hub_onboard_flows set setup_ticks = setup_ticks || '{"rd_hub": null}' where id = (select hire from w278_ids);
set local role authenticated;
do $$ begin assert public.wa278_hub_seen() = true, 'a cleared rd_hub is ticked again'; end $$;
reset role;
-- anon may not call it
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin perform public.wa278_hub_seen(); assert false, 'anon must not call hub_seen';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w278.hr@example.invalid"}', true);

select 'w278sql: all assertions passed' as result;
rollback;

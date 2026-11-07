-- Welfare Avenue Hub: wave293. Assertions for build/data/wa293_insights.sql (crm_insights_overview, the Insights tab's one call).
-- Assumes slice 1's files, wave289, test/w292schema.sql, wave292 and the migration are loaded. Everything runs in one transaction and ends with
-- a rollback; any failed assertion raises. Offline: node test/w293sql.mjs (PGlite).
-- Every person, organisation and id is invented (Test ..., example.org, example.invalid, gmail ids gm293...).

begin;
create function pg_temp.as_who(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', p_email, 'sub', md5(p_email))::text, true);
end $$;

-- ---------------------------------------------------------------- the structure
do $$
begin
  assert to_regprocedure('public.crm_insights_overview()') is not null, 'crm_insights_overview exists';
  assert not (select prosecdef from pg_proc where oid = 'public.crm_insights_overview()'::regprocedure), 'it is security invoker';
  assert has_function_privilege('authenticated', 'public.crm_insights_overview()', 'execute'), 'signed-in users call it';
  assert not has_function_privilege('anon', 'public.crm_insights_overview()', 'execute'), 'anon does not';
  assert obj_description('public.crm_insights_overview()'::regprocedure, 'pg_proc') is not null, 'it has a comment';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave293' and field = 'wave293') = 1, 'one release line';
end $$;

-- ---------------------------------------------------------------- invented data
insert into public.crm_contacts (id, full_name, emails, kinds) overriding system value values
  (9401, 'Test Hub Partner', array['hub.partner@org293.example.org'], '{partner}'),
  (9402, 'Test Steel Writer', array['steel.writer@org293.example.org'], '{}'),
  (9403, 'Test Quiet Donor', array['quiet.donor@example.org'], '{donor}'),
  (9404, 'Test Busy Volunteer', array['busy.volunteer@example.org'], '{volunteer}'),
  (9405, 'Test Gift Giver', array['gift.giver@example.org'], '{supporter}'),
  (9406, 'Test Deceased Donor', array['deceased.donor@example.org'], '{donor}'),
  (9407, 'Test Merged Partner', array['merged.partner@example.org'], '{partner}'),
  (9408, 'Test Quiet Typed', array['quiet.typed@example.org'], '{}'),
  (9409, 'Test Staff Only', array['staff.only@example.org'], '{staff}');
update public.crm_contacts set do_not_contact = true, dnc_reason = 'deceased' where id = 9406;
update public.crm_contacts set merged_into = 9401 where id = 9407;
insert into public.wa_partners (id, name, relationship, status, category) overriding system value values (9491, 'Test Org 293', 'partner', 'active', 'partner'), (9492, 'Test Leaders Org', 'sponsor', 'past', 'sponsor');
update public.wa_partners set visibility = 'leadership' where id = 9492;
insert into public.crm_contact_orgs (contact_id, partner_id) values (9401, 9491), (9402, 9491), (9408, 9492);
insert into public.crm_interactions (contact_id, kind, direction, channel, subject, body, occurred_at, source, source_ref, meta, created_by) values
  (9401, 'email', 'in', 'email', 'Test subject', 'Test line.', '2021-03-12 15:00+00', 'gmail', 'hub:gm293a:k1', '{"mailbox": "hub", "thread": "t1"}', 'Email history'),
  (9401, 'email', 'out', 'email', 'Test subject', 'Test line.', now() - interval '2 months', 'gmail', 'hub:gm293b:k1', '{"mailbox": "info", "thread": "t1"}', 'Email history'),
  (9402, 'email', 'in', 'email', 'Test subject', 'Test line.', now() - interval '3 months', 'gmail', 'steel:gm293c:k2', '{"mailbox": "steel", "thread": "t2"}', 'Email history'),
  (9403, 'email', 'in', 'email', 'Test subject', 'Test line.', '2022-06-01 15:00+00', 'gmail', 'hub:gm293d:k3', '{"mailbox": "hub", "thread": "t3"}', 'Email history'),
  (9404, 'note', 'internal', null, null, 'Test note.', now() - interval '1 month', 'hub', null, '{}', 'w281.admin@example.invalid'),
  (9404, 'email', 'in', 'email', 'Test subject', 'Test line.', '2020-05-01 15:00+00', 'gmail', 'hub:gm293e:k4', '{"mailbox": "hub", "thread": "t4"}', 'Email history'),
  (9405, 'email', 'in', 'email', 'Test subject', 'Test line.', '2021-01-01 15:00+00', 'gmail', 'hub:gm293f:k5', '{"mailbox": "hub", "thread": "t5"}', 'Email history'),
  (9406, 'email', 'in', 'email', 'Test subject', 'Test line.', '2021-01-01 15:00+00', 'gmail', 'hub:gm293g:k6', '{"mailbox": "hub", "thread": "t6"}', 'Email history'),
  (9407, 'email', 'in', 'email', 'Test subject', 'Test line.', '2021-01-01 15:00+00', 'gmail', 'hub:gm293h:k7', '{"mailbox": "hub", "thread": "t7"}', 'Email history'),
  (9408, 'email', 'in', 'email', 'Test subject', 'Test line.', '2019-01-01 15:00+00', 'gmail', 'steel:gm293i:k8', '{"mailbox": "steel", "thread": "t8"}', 'Email history'),
  (9409, 'note', 'internal', null, null, 'Test note.', '2020-01-01 15:00+00', 'hub', null, '{}', 'w281.admin@example.invalid');
insert into public.crm_donations (contact_id, amount, donated_at, platform) values (9405, 25, now() - interval '20 days', 'hub');
insert into public.crm_email_relationship (contact_id, rel_type, rel_conf, from_steel) values (9401, 'partner', 0.9, false), (9402, 'donor', 0.8, true), (9408, 'media', 0.7, true);

-- ---------------------------------------------------------------- an admin sees everything, Steel's lines included
select pg_temp.as_who('w281.admin@example.invalid');
set local role authenticated;
do $$
declare o jsonb := public.crm_insights_overview(); q jsonb; org jsonb;
begin
  assert (o ->> 'allowed')::boolean and (o ->> 'admin')::boolean and not (o ->> 'steel_open')::boolean, 'admin allowed, Steel''s lines still closed: ' || o::text;
  assert (o ->> 'quiet_months')::int = 12, 'the default quiet period is 12 months';
  assert exists (select 1 from jsonb_array_elements(o -> 'by_type_year') x where x ->> 'type' = 'donor'), 'an admin sees the type from Steel''s mailbox';
  assert exists (select 1 from jsonb_array_elements(o -> 'by_type_year') x where x ->> 'type' = 'partner' and (x ->> 'year')::int = 2021 and (x ->> 'people')::int = 1), 'a partner who wrote in 2021: ' || (o -> 'by_type_year')::text;
  assert exists (select 1 from jsonb_array_elements(o -> 'by_type_year') x where x ->> 'type' = 'none' and (x ->> 'year')::int = 2020), 'untyped writers count as none';
  assert not exists (select 1 from jsonb_array_elements(o -> 'by_type_year') x where (x ->> 'year')::int < 2020), 'nothing before 2020';
  assert (select coalesce(sum((x ->> 'people')::int), 0) from jsonb_array_elements(o -> 'by_type_year') x where (x ->> 'year')::int = 2021) = 3, 'a merged contact is not counted (2021: 9401, 9405 and 9406, not 9407): ' || (o -> 'by_type_year')::text;
  -- organisations: Test Org 293 has two writers (one from Steel's mailbox) and three emails
  select x into org from jsonb_array_elements(o -> 'orgs') x where x ->> 'name' = 'Test Org 293';
  assert (org ->> 'writers')::int = 2 and (org ->> 'emails')::int = 3 and (org ->> 'writers_12')::int = 2 and (org ->> 'emails_12')::int = 2 and org ->> 'status' = 'active', 'the organisation for an admin: ' || coalesce(org::text, 'null');
  assert (o ->> 'orgs_total')::int = 2, 'an admin (a leader) sees the leadership organisation too';
  -- gone quiet
  q := o -> 'quiet';
  assert exists (select 1 from jsonb_array_elements(q) x where (x ->> 'contact_id')::bigint = 9403 and x ->> 'kind' = 'donor' and x ->> 'last_was' = 'timeline'), 'the quiet donor is listed: ' || q::text;
  assert exists (select 1 from jsonb_array_elements(q) x where (x ->> 'contact_id')::bigint = 9408 and x ->> 'kind' = 'media') = false, 'a media type is not a quiet kind';
  assert not exists (select 1 from jsonb_array_elements(q) x where (x ->> 'contact_id')::bigint in (9401, 9404, 9405, 9406, 9407, 9409)), 'recent, giving, deceased, merged and staff-only contacts are not quiet: ' || q::text;
  assert (o ->> 'quiet_total')::int = jsonb_array_length(q), 'the total matches the list under 100';
  assert position('Test subject' in o::text) = 0 and position('Test line' in o::text) = 0 and position('@' in o::text) = 0, 'no subject, line or address in the answer';
end $$;
reset role;

-- ---------------------------------------------------------------- a CRM member: Steel's mailbox lines and the leadership organisation are left out
select pg_temp.as_who('w281.member@example.invalid');
set local role authenticated;
do $$
declare o jsonb := public.crm_insights_overview(); org jsonb;
begin
  assert (o ->> 'allowed')::boolean and not (o ->> 'admin')::boolean, 'a member is allowed, not an admin';
  select x into org from jsonb_array_elements(o -> 'orgs') x where x ->> 'name' = 'Test Org 293';
  assert (org ->> 'writers')::int = 1 and (org ->> 'emails')::int = 2, 'Steel''s mailbox lines do not count for a member: ' || coalesce(org::text, 'null');
  assert (o ->> 'orgs_total')::int = 1, 'a member does not see the leadership organisation';
  assert not exists (select 1 from jsonb_array_elements(o -> 'by_type_year') x where x ->> 'type' = 'donor'), 'the donor type row is from Steel''s mailbox: hidden';
end $$;
reset role;

-- ---------------------------------------------------------------- Steel opens his lines: the member sees them
select pg_temp.as_who('w281.admin@example.invalid');
update public.app_config set value = 'true' where key = 'mail_history_steel_open';
insert into public.app_config (key, value) select 'mail_insights_quiet_months', '6' where not exists (select 1 from public.app_config where key = 'mail_insights_quiet_months');
update public.app_config set value = '6' where key = 'mail_insights_quiet_months';
select pg_temp.as_who('w281.member@example.invalid');
set local role authenticated;
do $$
declare o jsonb := public.crm_insights_overview(); org jsonb;
begin
  select x into org from jsonb_array_elements(o -> 'orgs') x where x ->> 'name' = 'Test Org 293';
  assert (o ->> 'steel_open')::boolean and (org ->> 'writers')::int = 2, 'once open, the member counts Steel''s lines: ' || coalesce(org::text, 'null');
  assert (o ->> 'quiet_months')::int = 6, 'the setting moves the quiet period';
end $$;
reset role;
select pg_temp.as_who('w281.admin@example.invalid');
update public.app_config set value = 'false' where key = 'mail_history_steel_open';
update public.app_config set value = 'banana' where key = 'mail_insights_quiet_months';

-- ---------------------------------------------------------------- no CRM page, a board viewer, nobody signed in
select pg_temp.as_who('w281.nocrm@example.invalid');
set local role authenticated;
do $$
declare o jsonb := public.crm_insights_overview();
begin
  assert not (o ->> 'allowed')::boolean and jsonb_array_length(o -> 'by_type_year') = 0 and jsonb_array_length(o -> 'orgs') = 0 and jsonb_array_length(o -> 'quiet') = 0, 'no CRM page: empty';
  assert (o ->> 'quiet_months')::int = 12, 'a setting that is not a number falls back to 12';
end $$;
reset role;
insert into public.board_viewers (email) values ('w293.board@example.org');
select pg_temp.as_who('w293.board@example.org');
set local role authenticated;
do $$ begin assert not (public.crm_insights_overview() ->> 'allowed')::boolean, 'a board viewer: empty'; end $$;
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
do $$ begin assert not (public.crm_insights_overview() ->> 'allowed')::boolean, 'nobody signed in: empty'; end $$;
reset role;

select 'w293sql: all assertions passed' as result;
rollback;

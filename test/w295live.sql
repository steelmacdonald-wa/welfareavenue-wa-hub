-- Welfare Avenue Hub: wave295 live checks. Run on live ONLY inside build/sql_rollback_test.py's block (it rolls everything back), after
-- build/data/wa295_filters.sql; proved offline first by node test/w295sql.mjs. No transaction control. Prints nothing about anyone: every row it
-- reads back is one of its own invented people (Test W295 ..., example.invalid), and the timing reads only a count.
-- It checks: the new conditions on invented people (field of each type, kind/tag lists, a Keela tag name, chapter, dnc, phone, org, job title),
-- crm_filter_contacts for a real staff member with the CRM (picked inside the database, never printed) and its refusal for nobody signed in,
-- that no saved list or unsent Send holds a shape whose answer wave295 changes (the migration's own guard, again; it lists them by id), the
-- fail-closed shapes on live data, and that six conditions over every live contact answer in under one second (the design's bar), timed as a real
-- staff member through crm_filter_contacts (since round 4 the only way the page, Contacts and Lists alike, asks), with tag, type, chapter,
-- organisation, job title, a text field and a date field among them, and one condition the same way; crm_list_preview under row security is
-- timed too, as a NOTICE only (no bar: the page no longer calls it).

drop table if exists pg_temp.w295_who;   -- the block may run this file twice
drop table if exists pg_temp.w295_t;
create temp table w295_who (label text primary key, id bigint) on commit drop;
do $$
declare i bigint; f_choice bigint; f_date bigint; f_yes bigint;
begin
  insert into public.crm_fields (key, label, type, options, sort, created_by) values ('w295live_team', 'Test W295 team', 'choice', '["Quest", "Logic"]', 999, 'w295live') on conflict (key) do nothing;
  select id into f_choice from public.crm_fields where key = 'w295live_team';
  insert into public.crm_fields (key, label, type, options, sort, created_by) values ('w295live_day', 'Test W295 day', 'date', '[]', 999, 'w295live') on conflict (key) do nothing;
  select id into f_date from public.crm_fields where key = 'w295live_day';
  insert into public.crm_fields (key, label, type, options, sort, created_by) values ('w295live_yes', 'Test W295 yes', 'yes_no', '[]', 999, 'w295live') on conflict (key) do nothing;
  select id into f_yes from public.crm_fields where key = 'w295live_yes';
  insert into public.crm_contacts (full_name, emails, phones, kinds, tags, job_title, source)
    values ('Test W295 Fa', array['w295.fa@example.invalid'], array['+1 514 555 0191'], array['volunteer'], array['server', 'w295live tag'], 'Test W295 head cook', 'manual') returning id into i;
  insert into w295_who values ('fa', i);
  insert into public.crm_contact_chapters (contact_id, chapter, source, added_by) values (i, 'toronto', 'hand', 'w295live');
  insert into public.crm_contact_fields (contact_id, field_id, value, source) values (i, f_choice, '"Quest"', 'w295live'), (i, f_date, '"2025-06-01"', 'w295live'), (i, f_yes, 'true', 'w295live');
  insert into public.crm_contacts (full_name, emails, kinds, tags, source)
    values ('Test W295 Fb', array['w295.fb@example.invalid'], array['supporter'], array['w295live tag', 'w295live other'], 'manual') returning id into i;
  insert into w295_who values ('fb', i);
  delete from public.crm_contact_chapters where contact_id = i;   -- no chapter row: counted as Montreal
  update public.crm_contacts set do_not_contact = true, dnc_reason = 'other' where id = i;
  insert into public.crm_contact_fields (contact_id, field_id, value, source) values (i, f_choice, '"Logic"', 'w295live'), (i, f_date, '"2026-02-01"', 'w295live'), (i, f_yes, 'false', 'w295live');
end $$;

create or replace function pg_temp.who(k jsonb) returns text language sql as $$
  select coalesce(string_agg(w.label, ',' order by w.label), '-') from w295_who w
   where w.id in (select x from public.crm_list_preview(jsonb_build_object('groups', jsonb_build_array(jsonb_build_object('all', jsonb_build_array(k))))) x)
$$;

do $$
declare t0 timestamptz; ms numeric; n bigint; staff text;
begin
  assert pg_temp.who('{"f":"field","key":"w295live_team","op":"is","v":["quest"]}') = 'fa', 'live: field choice';
  assert pg_temp.who('{"f":"field","key":"w295live_team","op":"set"}') = 'fa,fb', 'live: field set';
  assert pg_temp.who('{"f":"field","key":"w295live_day","op":"after","v":"2026-01-01"}') = 'fb', 'live: field date after';
  assert pg_temp.who('{"f":"field","key":"w295live_yes","op":"is","v":"no"}') = 'fb', 'live: field yes/no';
  assert pg_temp.who('{"f":"field","key":"w295live_nothing","op":"empty"}') = '-', 'live: unknown field key matches nobody';
  assert pg_temp.who('{"f":"tag","op":"all","v":["w295live tag","w295live other"]}') = 'fb', 'live: tag all';
  assert pg_temp.who('{"f":"tag","op":"has","v":["w295live other","server"]}') = 'fa,fb', 'live: tag any';
  assert pg_temp.who('{"f":"kind","op":"none","v":["volunteer"]}') = 'fb', 'live: kind none of';
  assert pg_temp.who('{"f":"chapter","op":"is","v":"montreal"}') = 'fb', 'live: chapter montreal counts no chapter row';
  assert pg_temp.who('{"f":"chapter","op":"is","v":"toronto"}') = 'fa', 'live: chapter toronto';
  assert pg_temp.who('{"f":"dnc","op":"is"}') = 'fb', 'live: do not contact';
  assert pg_temp.who('{"f":"phone","op":"has"}') = 'fa', 'live: has a phone';
  assert pg_temp.who('{"f":"job_title","op":"contains","v":"w295 head"}') = 'fa', 'live: job title';
  -- fail closed on live data
  assert pg_temp.who('{"f":"birth","op":"is","v":"x"}') = '-' and pg_temp.who('{}') = '-', 'live: an unknown or missing field matches no one';
  assert pg_temp.who('{"f":"org","op":"contains","v":""}') = '-' and pg_temp.who('{"f":"tag","op":"none","v":[]}') = '-', 'live: a blank value or an empty list matches no one';
  assert pg_temp.who('{"f":"chapter","op":"not","v":["montreal","toronto"]}') = '-', 'live: a list where one value is meant matches no one';
  assert (select count(*) from public.crm_list_preview('{"groups":[]}')) = 0 and (select count(*) from public.crm_list_preview('{"groups":[{"all":[]}]}')) = 0, 'live: no group, or an empty group, matches no one';
  if exists (select 1 from public.crm_tag_aliases() a where public.crm_fold(a.alias) = 'volunteer server' and public.crm_fold(a.tag) = 'server') then
    assert pg_temp.who('{"f":"tag","op":"has","v":"Volunteer Server"}') like '%fa%', 'live: the Keela name Volunteer Server finds server';
  end if;

  -- crm_filter_contacts as a real staff member with the CRM (picked here, never printed), and refused for nobody signed in
  select r.email into staff from public.hub_roles r where r.role = 'admin' order by r.email limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', staff)::text, true);
  assert (select count(*) from public.crm_filter_contacts('{"groups":[{"all":[{"f":"tag","op":"has","v":["w295live tag"]}]}]}') x where x.id in (select id from w295_who)) = 2,
    'live: crm_filter_contacts gives a staff member the ids';
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.crm_filter_contacts('{"groups":[]}');
    raise exception 'live: crm_filter_contacts answered nobody';
  exception when insufficient_privilege then null;
  end;
end $$;
-- the release guard again: no saved list or unsent Send may hold a shape whose answer this wave changes (names them by id)
do $$
declare m text;
begin
  if to_regclass('public.crm_lists') is not null and to_regprocedure('pg_temp.wa295_filter_change(jsonb)') is not null then
    select string_agg('list ' || l.id || ': ' || pg_temp.wa295_filter_change(l.filter), ' | ' order by l.id) into m
      from public.crm_lists l where coalesce(l.kind, 'dynamic') <> 'static' and pg_temp.wa295_filter_change(l.filter) is not null;
    assert m is null, 'live: saved lists whose answer wave295 changes: ' || coalesce(m, '');
  end if;
end $$;

-- speed: six conditions over every live contact, as a real staff member (picked here, never printed); only counts are read
-- round 4 (09/11/26): the page (Contacts and Lists) asks crm_filter_contacts only, so that is the path with the 1 second bar, for six conditions
-- and for one. crm_list_preview under row security (what the Lists page used before round 4) is timed for the record only, as a NOTICE.
create temp table if not exists w295_t (way text, ms numeric, n bigint, gate boolean) on commit drop;
grant all on w295_t to authenticated;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', (select r.email from public.hub_roles r where r.role = 'admin' order by r.email limit 1))::text, true);
set local role authenticated;
do $$
declare t0 timestamptz; n bigint;
  f jsonb := '{"groups":[{"all":[{"f":"tag","op":"has","v":["server","newsletter"]},{"f":"kind","op":"is","v":["volunteer","supporter"]},{"f":"chapter","op":"is","v":"montreal"},{"f":"dnc","op":"not"},{"f":"org","op":"not","v":"w295 nothing like it"},{"f":"field","key":"rally_paper_team","op":"empty"}]},{"all":[{"f":"job_title","op":"contains","v":"coordinator"},{"f":"field","key":"instagram","op":"contains","v":"wa"},{"f":"field","key":"w295live_day","op":"after","v":"2020-01-01"},{"f":"served","op":"ever"},{"f":"tag","op":"none","v":["w295 nothing"]},{"f":"city","op":"contains","v":"mon"}]}]}';
  f1 jsonb := '{"groups":[{"all":[{"f":"kind","op":"is","v":"volunteer"}]}]}';
begin
  t0 := clock_timestamp(); select count(*) into n from public.crm_filter_contacts(f);
  insert into w295_t values ('crm_filter_contacts, six conditions (two groups)', extract(epoch from clock_timestamp() - t0) * 1000, n, true);
  t0 := clock_timestamp(); select count(*) into n from public.crm_filter_contacts(f1);
  insert into w295_t values ('crm_filter_contacts, one condition', extract(epoch from clock_timestamp() - t0) * 1000, n, true);
  t0 := clock_timestamp(); select count(*) into n from public.crm_list_preview(f);
  insert into w295_t values ('crm_list_preview with row security, six conditions (not used by the page; no bar)', extract(epoch from clock_timestamp() - t0) * 1000, n, false);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare r record;
begin
  for r in select * from w295_t loop
    raise notice 'w295live: % over every live contact took % ms', r.way, round(r.ms);
    if r.gate then assert r.ms < 1000, 'live: ' || r.way || ' answers in under 1 second (' || round(r.ms) || ' ms)'; end if;
  end loop;
  assert (select count(distinct n) from w295_t where way like '%six%') = 1, 'live: crm_filter_contacts and crm_list_preview give the same count';
end $$;
drop table if exists pg_temp.w295_t;

select 'w295live: all checks passed' as result;

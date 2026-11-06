-- Welfare Avenue Hub: wave286. Assertions for build/data/wa286_vm_chapter.sql (Toronto crews in the CRM, the reduced Phase 5b of the Hub CRM
-- slice 1). Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w286schema.sql and the migration are loaded. Everything runs in one
-- transaction and ends with a rollback; any failed assertion raises. Offline: node test/w286sql.mjs (PGlite). Every row is invented.

begin;

-- ---------------------------------------------------------------- the backfill: the crews already there
do $$
begin
  assert (select count(*) from public.crm_contact_chapters where source_ref like 'Toronto crew:%') = 2, 'the backfill added two people (8601, 8602)';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8601 and chapter = 'toronto' and source = 'serving' and source_ref = 'Toronto crew: TO-26-1' and added_by = 'wave286'),
    'a crew member named by detail.contact_id joined Toronto (source serving, Toronto crew: <code>)';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8602 and chapter = 'toronto' and source_ref = 'Toronto crew: TO-26-2'),
    'a crew member found by the volunteer record joined Toronto, once, with their first crew row''s event';
  assert (select source from public.crm_contact_chapters where contact_id = 8603 and chapter = 'toronto') = 'hand', 'a Toronto row already there is kept as it was';
  assert not exists (select 1 from public.crm_contact_chapters where contact_id in (8604, 8605)), 'a merged contact is skipped (and nobody else is guessed)';
  assert not exists (select 1 from public.crm_contact_chapters where contact_id in (8607, 8609) and chapter = 'toronto'), 'a Montreal serving, even one held in Toronto, adds nothing';
  assert not exists (select 1 from public.crm_contact_chapters where chapter = 'montreal' and source = 'serving' and source_ref like 'Toronto crew:%'), 'nothing adds montreal';
end $$;

-- ---------------------------------------------------------------- the trigger
do $$
declare n_mtl int := (select count(*) from public.crm_contact_chapters where chapter = 'montreal'); n int; v_id bigint;
begin
  -- a crew add on a Toronto event, as wa274_crew_add writes it (the contact in detail, a TBD row)
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8612, null, 'Test New Crew', 'cook', 'TBD', '{"source": "toronto", "contact_id": 8608}');
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8608 and chapter = 'toronto' and source = 'serving' and source_ref = 'Toronto crew: TO-26-2' and added_by = 'system'),
    'a crew add on a Toronto event adds the Toronto row';
  -- a Montreal serving adds nothing; a Montreal-kind serving held in Toronto adds nothing
  select count(*) into n from public.crm_contact_chapters;
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8613, 8710, 'Test Late Volunteer', 'server', 'Confirmed');
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8614, 8710, 'Test Late Volunteer', 'server', 'Confirmed');
  assert (select count(*) from public.crm_contact_chapters) = n, 'a Montreal serving adds nothing';
  -- the same person again, a row with nobody, a row whose contact is not a number: nothing more
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8611, null, 'Test New Crew', 'server', 'TBD', '{"contact_id": 8608}');
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8611, null, 'A partner kitchen', 'cook', 'TBD', '{}');
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8611, null, 'A partner kitchen', 'cook', 'TBD', '{"contact_id": "12x"}');
  assert (select count(*) from public.crm_contact_chapters) = n, 'a second crew row, a row with nobody and a contact that is not a number add nothing more';
  -- a person put on a row later (update of person_id), and a row moved to a Toronto event (update of event_id)
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8611, null, 'To be named', 'driver', 'TBD') returning id into v_id;
  update public.event_roster set person_id = 8710 where id = v_id;
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8610 and chapter = 'toronto' and source_ref = 'Toronto crew: TO-26-1'), 'a person set on a Toronto crew row later joins Toronto';
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8613, 8711, 'Test Moved Volunteer', 'server', 'TBD') returning id into v_id;
  assert not exists (select 1 from public.crm_contact_chapters where contact_id = 8611), 'on a Montreal serving first: nothing';
  update public.event_roster set event_id = 8612 where id = v_id;
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8611 and chapter = 'toronto' and source_ref = 'Toronto crew: TO-26-2'), 'moved to a Toronto event: joins Toronto';
  -- a merged contact in detail: skipped; the volunteer record's contact is used when there is one
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8611, 8705, 'Test Merged Crew', 'server', 'TBD', '{"contact_id": 8604}');
  assert not exists (select 1 from public.crm_contact_chapters where contact_id = 8604), 'the merged contact never gets a row';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8605 and chapter = 'toronto'), 'the volunteer record''s live contact does';
  -- a staff member's crew add is recorded as them
  perform set_config('request.jwt.claims', '{"email": "w286.staff@example.invalid", "role": "authenticated"}', true);
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8612, 8709, 'Test Montreal Volunteer', 'cook', 'TBD');
  assert (select added_by from public.crm_contact_chapters where contact_id = 8609 and chapter = 'toronto') = 'w286.staff@example.invalid', 'the row names the staff member who added the crew member';
  perform set_config('request.jwt.claims', '', true);
  -- it never removes a row, and never adds montreal
  delete from public.event_roster where id = 8621;
  update public.event_roster set event_id = 8613 where id = 8622;
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8601 and chapter = 'toronto') and exists (select 1 from public.crm_contact_chapters where contact_id = 8602 and chapter = 'toronto'),
    'a crew row removed or moved away leaves the Toronto row';
  assert (select count(*) from public.crm_contact_chapters where chapter = 'montreal') = n_mtl, 'no montreal row was added';
end $$;

-- ---------------------------------------------------------------- the CRM side never fails a crew add
do $$
declare v_id bigint;
begin
  -- the toronto chapter is missing (its rows go first, so the chapter can go): the chapter write fails, the crew add stands
  delete from public.crm_contact_chapters where chapter = 'toronto';
  delete from public.crm_chapters where code = 'toronto';
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8612, null, 'Test New Crew', 'driver', 'TBD', '{"contact_id": 8608}') returning id into v_id;
  assert v_id is not null and exists (select 1 from public.event_roster where id = v_id), 'with no toronto chapter, a Toronto crew add still succeeds';
  assert not exists (select 1 from public.crm_contact_chapters where chapter = 'toronto'), 'and adds no chapter row';
  -- a forced error in the chapter write (as a later trigger could raise): the same
  insert into public.crm_chapters (code, name_en, name_fr, active, mail_route, ops_team, sort) values ('toronto', 'Toronto', 'Toronto', true, 'toronto', 'opsto', 2);
  execute $f$create or replace function public.crm_add_chapter(p_contact bigint, p_chapter text, p_source text, p_ref text) returns boolean language plpgsql security definer set search_path to '' as $b$ begin raise exception 'forced for the test'; end $b$ $f$;
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (8612, null, 'Test New Crew', 'server', 'TBD', '{"contact_id": 8608}') returning id into v_id;
  assert v_id is not null and not exists (select 1 from public.crm_contact_chapters where contact_id = 8608), 'with the chapter write failing, a Toronto crew add still succeeds and adds no row';
end $$;

-- ---------------------------------------------------------------- grants, security, comments
do $$
begin
  assert (select proacl::text from pg_proc where oid = 'public.wa286_crew_contact(jsonb,bigint)'::regprocedure) = '{postgres=X/postgres,service_role=X/postgres}', 'wa286_crew_contact: service role only';
  assert (select prosecdef and provolatile = 's' and proconfig::text = '{"search_path=\"\""}' from pg_proc where oid = 'public.wa286_crew_contact(jsonb,bigint)'::regprocedure),
    'wa286_crew_contact is stable, security definer, with an empty search_path';
  assert (select proacl::text from pg_proc where oid = 'public.wa286_toronto_crew()'::regprocedure) = '{postgres=X/postgres,service_role=X/postgres}', 'the trigger function has no grant to signed-in users or anon';
  assert (select prosecdef and proconfig::text = '{"search_path=\"\""}' from pg_proc where oid = 'public.wa286_toronto_crew()'::regprocedure), 'the trigger function is security definer with an empty search_path';
  assert (select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_wa286_toronto_crew')
     = 'CREATE TRIGGER trg_wa286_toronto_crew AFTER INSERT OR UPDATE OF event_id, person_id ON public.event_roster FOR EACH ROW EXECUTE FUNCTION wa286_toronto_crew()',
    'the trigger: after insert, or after update of event_id or person_id';
  assert obj_description('public.wa286_crew_contact(jsonb,bigint)'::regprocedure, 'pg_proc') like 'wave286:%'
     and obj_description('public.wa286_toronto_crew()'::regprocedure, 'pg_proc') like 'wave286:%'
     and (select obj_description(oid, 'pg_trigger') from pg_trigger where tgname = 'trg_wa286_toronto_crew') like 'wave286:%', 'the comments say what wave286 did';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286') = 1
     and (select new_value from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286') like '% 2 people from the crews already there joined it.',
    'one release line, with the backfill''s count';
end $$;

select 'w286sql: all assertions passed' as result;
rollback;

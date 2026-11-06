-- Welfare Avenue Hub: wave286. Assertions for build/data/wa286_vm_chapter.sql (Phase 5b of the Hub CRM slice 1: the Volunteer Manager by chapter).
-- Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w286schema.sql (with the live wa191_recruit_pool and wa266f_email_drain) and the
-- migration are loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises. Offline: node test/w286sql.mjs
-- (PGlite). Every row is invented (Test ..., example.invalid, 555 numbers).

begin;

-- ---------------------------------------------------------------- 35.1 and 35.2: a serving's chapter
do $$
begin
  assert (select count(*) from public.volunteer_events where chapter is distinct from 'montreal') = 0, 'every serving that was there is Montreal';
  assert (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_events' and column_name = 'chapter') = '''montreal''::text'
     and (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_events' and column_name = 'chapter') = 'NO',
    'volunteer_events.chapter is not null and defaults to montreal';
  assert exists (select 1 from pg_constraint where conrelid = 'public.volunteer_events'::regclass and contype = 'f' and confrelid = 'public.crm_chapters'::regclass),
    'volunteer_events.chapter references crm_chapters';
  assert exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'volunteer_events' and indexname = 'volunteer_events_chapter_idx'), 'volunteer_events.chapter has an index';
  begin
    insert into public.volunteer_events (event_date, chapter) values (date '2026-12-27', 'ottawa');
    raise exception 'an unknown chapter was accepted';
  exception when foreign_key_violation then null;
  end;
  assert (select attname from pg_attribute where attrelid = 'public.volunteer_event_summary'::regclass and attnum > 0 and not attisdropped order by attnum desc limit 1) = 'chapter',
    'volunteer_event_summary ends with chapter';
  assert (select count(*) from pg_attribute where attrelid = 'public.volunteer_event_summary'::regclass and attnum > 0 and not attisdropped) = 20, 'volunteer_event_summary keeps its 19 columns and adds one';
  assert (select reloptions::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) = '{security_invoker=on}', 'volunteer_event_summary stays security invoker';
  assert (select roster_count = 1 and roster_confirmed = 1 and chapter = 'montreal' from public.volunteer_event_summary where id = 8613), 'the view still counts the roster, and says montreal';
end $$;

-- the Toronto serving
update public.volunteer_events set chapter = 'toronto' where id = 8612;
do $$
begin
  assert (select chapter from public.volunteer_event_summary where id = 8612) = 'toronto', 'the view shows a Toronto serving''s chapter';
end $$;

-- ---------------------------------------------------------------- 35.3: a confirmed volunteer joins the serving's chapter
do $$
declare n int;
begin
  assert not exists (select 1 from public.crm_contact_chapters where contact_id = 8605), 'before: 8605 has no chapter';
  update public.event_roster set status = 'Confirmed' where id = 8621;
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8605 and chapter = 'toronto' and source = 'serving' and source_ref = 'serving WA-26-862' and added_by = 'system'),
    'a confirmed roster row on a Toronto serving adds the toronto chapter (source serving)';
  assert (select count(*) from public.crm_contact_chapters where contact_id = 8605) = 1, 'and only the toronto chapter';
  -- a row inserted already confirmed
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8612, 8607, 'Test Montreal Row', 'driver', 'Confirmed');
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8607 and chapter = 'toronto' and source = 'serving'), 'a row inserted as Confirmed adds the chapter too';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8607 and chapter = 'montreal' and source = 'hand'), 'the montreal row already there is kept';
  -- confirmed on a Montreal serving (the status set again to the same value): the montreal row
  update public.event_roster set status = 'Confirmed' where id = 8622;
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 8601 and chapter = 'montreal' and source = 'serving'), 'a confirmed roster row on a Montreal serving adds montreal';
  -- nothing for a waiting row, a row with nobody, or a person with no contact; and a second confirmation adds nothing
  select count(*) into n from public.crm_contact_chapters;
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8612, 8606, 'Test Montreal Stopped', 'cook', 'Waiting For Response');
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8612, null, 'A partner kitchen', 'cook', 'Confirmed');
  insert into public.event_roster (event_id, person_id, person_name, role, status) values (8612, 999999, 'Nobody in the CRM', 'cook', 'Confirmed');
  update public.event_roster set status = 'Confirmed' where id = 8621;
  update public.event_roster set notes = 'a note' where id = 8623;
  assert (select count(*) from public.crm_contact_chapters) = n, 'a waiting row, a row with nobody, a person with no contact and a second confirmation add no chapter';
  -- a staff member confirming is recorded as them
  perform set_config('request.jwt.claims', '{"email": "w286.staff@example.invalid", "role": "authenticated"}', true);
  update public.event_roster set status = 'Confirmed' where person_id = 8606 and event_id = 8612;
  assert (select added_by from public.crm_contact_chapters where contact_id = 8606 and chapter = 'toronto') = 'w286.staff@example.invalid', 'the chapter row names the staff member who confirmed';
  perform set_config('request.jwt.claims', '', true);
  delete from public.crm_contact_chapters where contact_id = 8606;   -- 8606 stays with no chapter for the checks below
  delete from public.event_roster where person_id = 8606;
end $$;

-- ---------------------------------------------------------------- 35.4: Find volunteers by chapter, never a do-not-contact person
update public.crm_contacts set do_not_contact = true where id in (8603, 8606);
select set_config('request.jwt.claims', '{"email": "w286.staff@example.invalid", "role": "authenticated"}', true);
do $$
declare j jsonb; ids bigint[]; e text := '';
begin
  assert (select count(*) from pg_proc where proname = 'wa191_recruit_pool' and pronamespace = 'public'::regnamespace) = 1, 'one wa191_recruit_pool only';
  j := public.wa191_recruit_pool(p_chapter => 'toronto');
  ids := array(select (x->>'c')::bigint from jsonb_array_elements(j->'people') x where (x->>'c')::bigint between 8600 and 8699 order by 1);
  assert ids = array[8602, 8604, 8605, 8607]::bigint[], 'toronto: the Toronto people, without Montreal-only people or do-not-contact (' || ids::text || ')';
  j := public.wa191_recruit_pool(p_chapter => 'montreal');
  ids := array(select (x->>'c')::bigint from jsonb_array_elements(j->'people') x where (x->>'c')::bigint between 8600 and 8699 order by 1);
  assert ids = array[8601, 8604, 8607]::bigint[], 'montreal: a montreal row or no row at all, without do-not-contact (' || ids::text || ')';
  j := public.wa191_recruit_pool();
  ids := array(select (x->>'c')::bigint from jsonb_array_elements(j->'people') x where (x->>'c')::bigint between 8600 and 8699 order by 1);
  assert ids = array[8601, 8602, 8604, 8605, 8607]::bigint[], 'all chapters (no p_chapter): everyone but do-not-contact (' || ids::text || ')';
  assert (select count(*) from jsonb_array_elements(j->'people') x where (x->>'c')::bigint in (1101, 1105, 1106)) = 3, 'the people from the other fixture are still found';
  -- today's calls (three named arguments, or three in order) still work
  j := public.wa191_recruit_pool(p_events => array[8612]::bigint[], p_lapsed_days => 60, p_regular_min => 3);
  ids := array(select (x->>'c')::bigint from jsonb_array_elements(j->'people') x where (x->>'c')::bigint between 8600 and 8699 order by 1);
  assert ids = array[8601, 8602, 8604, 8605, 8607]::bigint[] and (j->>'lapsed_days')::int = 60, 'the page''s three named arguments still work';
  j := public.wa191_recruit_pool(array[8612]::bigint[], 30, 2, 'toronto');
  assert (select x->'on' from jsonb_array_elements(j->'people') x where (x->>'c')::bigint = 8605) @> '[{"e": 8612, "st": "Confirmed"}]'::jsonb and (j->>'lapsed_days')::int = 30,
    'four arguments in order: their rows on the chosen serving';
  j := public.wa191_recruit_pool(null, 60, 3);
  assert jsonb_typeof(j->'people') = 'array', 'three arguments in order';
  -- staff only, as before
  perform set_config('request.jwt.claims', '{"email": "someone@example.invalid", "role": "authenticated"}', true);
  begin
    perform public.wa191_recruit_pool(p_chapter => 'toronto');
  exception when others then e := sqlerrm;
  end;
  assert e = 'Staff only', 'not staff: refused (' || e || ')';
end $$;

-- ---------------------------------------------------------------- 35.5: the chapter map
do $$
declare m jsonb;
begin
  perform set_config('request.jwt.claims', '{"email": "w286.staff@example.invalid", "role": "authenticated"}', true);
  m := public.wa286_volunteer_chapters();
  assert m -> '8602' = '["toronto"]'::jsonb and m -> '8604' = '["montreal", "toronto"]'::jsonb and m -> '8605' = '["toronto"]'::jsonb
     and m -> '8607' = '["montreal", "toronto"]'::jsonb and m -> '8601' = '["montreal"]'::jsonb, 'staff: each volunteer''s chapters, keyed by volunteer id (' || m::text || ')';
  assert not (m ? '8606'), 'a volunteer with no chapter row is left out (Montreal on the page)';
  assert m -> '501' = '["montreal"]'::jsonb, 'wave281''s backfill rows count too';
  perform set_config('request.jwt.claims', '{"email": "someone@example.invalid", "role": "authenticated"}', true);
  assert public.wa286_volunteer_chapters() = '{}'::jsonb, 'not staff: {}';
  perform set_config('request.jwt.claims', '', true);
  assert public.wa286_volunteer_chapters() = '{}'::jsonb, 'nobody signed in: {}';
end $$;

-- ---------------------------------------------------------------- 35.6: the drain sends from the serving's chapter address
select set_config('request.jwt.claims', '', true);
do $$
declare r jsonb; t jsonb; m jsonb;
begin
  delete from public.w286_http_log;
  r := public.wa266f_email_drain(10);
  assert (r->>'emailed')::int = 2, 'the drain emailed both waiting confirmations (' || r::text || ')';
  select content::jsonb into t from public.w286_http_log where (content::jsonb->>'contact_id')::bigint = 8602;
  select content::jsonb into m from public.w286_http_log where (content::jsonb->>'contact_id')::bigint = 8601;
  assert t->>'route' = 'toronto', 'the payload for a Toronto serving carries route toronto (' || coalesce(t::text, 'none') || ')';
  assert m->>'route' = 'volunteer', 'the payload for a Montreal serving carries route volunteer, its default';
  assert t->>'action' = 'send' and t->>'template_key' = 'volunteer_assigned' and t->>'reply_to' = 'w286.owner@example.invalid' and not (t->'vars' ? 'route'),
    'the route sits at the top level, next to reply_to, and the vars are as before';
  assert (select count(*) from public.quo_messages where roster_id in (8622, 8623) and delivery = 'email') = 2, 'both texts are marked as emailed';
end $$;

-- ---------------------------------------------------------------- grants, security and comments
do $$
begin
  assert (select proacl::text from pg_proc where oid = 'public.wa191_recruit_pool(bigint[],integer,integer,text)'::regprocedure) = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}',
    'wa191_recruit_pool keeps its live grants (authenticated, service_role)';
  assert (select prosecdef and provolatile = 's' from pg_proc where oid = 'public.wa191_recruit_pool(bigint[],integer,integer,text)'::regprocedure), 'wa191_recruit_pool stays stable and security definer';
  assert (select pg_get_function_arguments(oid) from pg_proc where oid = 'public.wa191_recruit_pool(bigint[],integer,integer,text)'::regprocedure)
     = 'p_events bigint[] DEFAULT NULL::bigint[], p_lapsed_days integer DEFAULT 60, p_regular_min integer DEFAULT 3, p_chapter text DEFAULT NULL::text', 'the four arguments, with the live defaults';
  assert (select proacl::text from pg_proc where oid = 'public.wa266f_email_drain(integer)'::regprocedure) = '{postgres=X/postgres,service_role=X/postgres}', 'the drain keeps its live grants (service role only)';
  assert (select proacl::text from pg_proc where oid = 'public.wa286_volunteer_chapters()'::regprocedure) = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}',
    'wa286_volunteer_chapters: authenticated and service role, never anon';
  assert (select prosecdef and provolatile = 's' and proconfig::text = '{"search_path=\"\""}' from pg_proc where oid = 'public.wa286_volunteer_chapters()'::regprocedure),
    'wa286_volunteer_chapters is stable, security definer, with an empty search_path';
  assert (select proacl::text from pg_proc where oid = 'public.wa286_roster_chapter()'::regprocedure) = '{postgres=X/postgres,service_role=X/postgres}', 'the trigger function has no grant to signed-in users';
  assert (select prosecdef and proconfig::text = '{"search_path=\"\""}' from pg_proc where oid = 'public.wa286_roster_chapter()'::regprocedure), 'the trigger function is security definer with an empty search_path';
  assert (select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_wa286_roster_chapter')
     = 'CREATE TRIGGER trg_wa286_roster_chapter AFTER INSERT OR UPDATE OF status ON public.event_roster FOR EACH ROW WHEN ((new.status = ''Confirmed''::text)) EXECUTE FUNCTION wa286_roster_chapter()',
    'the trigger: after insert or update of status, only for Confirmed';
  assert (select relacl::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) = '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}',
    'volunteer_event_summary: signed-in users read it, nobody writes through it, anon nothing';
  assert obj_description('public.wa286_volunteer_chapters()'::regprocedure, 'pg_proc') like 'wave286:%'
     and obj_description('public.wa286_roster_chapter()'::regprocedure, 'pg_proc') like 'wave286:%'
     and obj_description('public.wa191_recruit_pool(bigint[],integer,integer,text)'::regprocedure, 'pg_proc') like 'wave191e:%wave286: p_chapter%'
     and obj_description('public.wa266f_email_drain(integer)'::regprocedure, 'pg_proc') like '%wave286: the email goes from the serving''s chapter address%'
     and obj_description('public.volunteer_event_summary'::regclass, 'pg_class') like '%wave286 adds chapter%'
     and col_description('public.volunteer_events'::regclass, (select attnum from pg_attribute where attrelid = 'public.volunteer_events'::regclass and attname = 'chapter')) like 'wave286:%',
    'the comments say what wave286 did';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286') = 1, 'one release line';
end $$;

select 'w286sql: all assertions passed' as result;
rollback;

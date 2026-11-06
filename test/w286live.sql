-- wave286: assertions on the live database, after build/data/wa281_rules.sql, test/w286live_before.sql and build/data/wa286_vm_chapter.sql (run
-- twice). Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back (the test Toronto event and the roster rows it adds
-- for the trigger check included). No transaction control. Raises on the first failure, with the check's name and counts only; personal data never
-- leaves the database. The contact used for the trigger check is picked inside the database and never printed.

do $live$
declare s record; n bigint; v_ev bigint; v_mtl bigint; v_contact bigint; v_contact2 bigint;
begin
  select * into s from pg_temp.w286_state_before;

  -- the backfill: exactly the expected people, all Toronto, with wave286's source note; every row of before still there; no montreal row added
  select count(*) into n from public.crm_contact_chapters where source_ref like 'Toronto crew:%';
  if n <> s.expected then raise exception 'w286live: the backfill added % people, expected %', n, s.expected; end if;
  if exists (select 1 from public.crm_contact_chapters where source_ref like 'Toronto crew:%' and (chapter <> 'toronto' or source <> 'serving' or added_by <> 'wave286')) then
    raise exception 'w286live: a backfilled row is not a Toronto row from wave286';
  end if;
  select count(*) into n from (select contact_id, chapter, source, source_ref, added_by from pg_temp.w286_rows_before
                               except all select contact_id, chapter, source, source_ref, added_by from public.crm_contact_chapters) x;
  if n <> 0 then raise exception 'w286live: % chapter rows of before are missing or changed', n; end if;
  if (select count(*) from public.crm_contact_chapters) <> (select count(*) from pg_temp.w286_rows_before) + s.expected then raise exception 'w286live: rows other than the backfill were added'; end if;
  if (select count(*) from public.event_roster) <> s.roster or (select count(*) from public.volunteer_events) <> s.events then raise exception 'w286live: a roster row or an event moved'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286') <> 1 then raise exception 'w286live: not one release line'; end if;
  if (select new_value from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286') not like '% ' || s.expected || ' people from the crews already there joined it.' then
    raise exception 'w286live: the release line does not carry the backfill''s count';
  end if;

  -- grants and security
  if (select proacl::text from pg_proc where oid = 'public.wa286_crew_contact(jsonb,bigint)'::regprocedure) ~ '(anon|authenticated)=|^\{=|,=' then raise exception 'w286live: wa286_crew_contact is open to signed-in users or anon'; end if;
  if (select proacl::text from pg_proc where oid = 'public.wa286_toronto_crew()'::regprocedure) ~ '(anon|authenticated)=|^\{=|,=' then raise exception 'w286live: the trigger function is open to signed-in users or anon'; end if;
  if not (select prosecdef and proconfig::text = '{"search_path=\"\""}' from pg_proc where oid = 'public.wa286_toronto_crew()'::regprocedure) then raise exception 'w286live: the trigger function is not security definer with an empty search_path'; end if;

  -- the trigger: a crew add on a Toronto event (made here, rolled back) adds the Toronto row; a crew add on a Montreal serving adds nothing
  select c.id into v_contact from public.crm_contacts c where c.merged_into is null and not exists (select 1 from public.crm_contact_chapters x where x.contact_id = c.id and x.chapter = 'toronto') order by c.id limit 1;
  select c.id into v_contact2 from public.crm_contacts c where c.merged_into is null and c.id <> v_contact and not exists (select 1 from public.crm_contact_chapters x where x.contact_id = c.id) order by c.id limit 1;
  select e.id into v_mtl from public.volunteer_events e where e.kind = 'service' order by e.event_date desc, e.id desc limit 1;
  if v_contact is null or v_contact2 is null or v_mtl is null then raise exception 'w286live: no contact or serving to try the trigger with'; end if;
  insert into public.volunteer_events (code, event_date, status, kind, location, title) values ('TO-W286-CHECK', current_date + 30, 'planned', 'meal', 'Toronto', 'wave286 live check') returning id into v_ev;
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (v_ev, null, 'wave286 live check', 'server', 'TBD', jsonb_build_object('source', 'toronto', 'contact_id', v_contact));
  if not exists (select 1 from public.crm_contact_chapters where contact_id = v_contact and chapter = 'toronto' and source = 'serving' and source_ref = 'Toronto crew: TO-W286-CHECK') then
    raise exception 'w286live: a crew add on a Toronto event did not add the Toronto row';
  end if;
  select count(*) into n from public.crm_contact_chapters;
  insert into public.event_roster (event_id, person_id, person_name, role, status, detail) values (v_mtl, null, 'wave286 live check', 'server', 'TBD', jsonb_build_object('contact_id', v_contact2));
  if (select count(*) from public.crm_contact_chapters) <> n then raise exception 'w286live: a crew add on a Montreal serving added a chapter row'; end if;
end $live$;

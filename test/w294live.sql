-- wave294: checks on the live database after build/data/wa294_keela_tags.sql (run twice), inside the block build/sql_rollback_test.py prints, so everything
-- rolls back. No transaction control. Raises on the first failure with the check's name only; personal data never leaves the database. It works on invented
-- people only (Keela ids W294LIVE-..., addresses at example.invalid). Needs wave284 live. Proved offline first by test/w294sql.mjs on the fixture.

do $live$
declare
  s regprocedure := 'public.crm_tag_aliases()'::regprocedure; w regprocedure := 'public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure;
  m jsonb; v_kid text; v_mail text; v_run bigint; v_file bigint; b bigint; r jsonb; v_c bigint; v_t text[];
begin
  -- the function, its grants and its comment
  if has_function_privilege('anon', s, 'execute') then raise exception 'w294live: anon can run crm_tag_aliases'; end if;
  if not has_function_privilege('authenticated', s, 'execute') then raise exception 'w294live: authenticated cannot run crm_tag_aliases'; end if;
  if not has_function_privilege('service_role', s, 'execute') then raise exception 'w294live: the service role cannot run crm_tag_aliases'; end if;
  if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = s and a.grantee = 0) then raise exception 'w294live: public can run crm_tag_aliases'; end if;
  if not (select prosecdef from pg_proc where oid = s) or (select provolatile from pg_proc where oid = s) <> 's' or (select proconfig::text from pg_proc where oid = s) not like '%search_path=%' then
    raise exception 'w294live: crm_tag_aliases is not security definer, stable and pinned';
  end if;
  if obj_description(s, 'pg_proc') is null or obj_description(w, 'pg_proc') not like 'wave284 (changed by wave294):%' then raise exception 'w294live: a comment is missing'; end if;
  if has_function_privilege('anon', w, 'execute') or has_function_privilege('authenticated', w, 'execute') then raise exception 'w294live: the batch 7 writer opened to signed-in users'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'wave294') <> 1 then raise exception 'w294live: not one release line'; end if;

  -- the map: wave284's own entries kept, the donor tags renamed, every alias lower case
  select c.value::jsonb into m from public.app_config c where c.key = 'keela_tag_map';
  if m -> 'Rally Paper Participant' ->> 'campaign' is distinct from 'Rally Paper 2026' or m -> 'Toronto Volunteers' ->> 'chapter' is distinct from 'toronto'
     or (m -> 'Welcome Series Exit #1' ->> 'skip') is distinct from 'true' then raise exception 'w294live: a wave284 entry changed'; end if;
  if not (m ? 'Volunteer Server' and m ? 'Partner' and m ? 'Corporate Fundraising' and m ? 'Pickup') then raise exception 'w294live: the map lacks a wave294 key'; end if;
  if exists (select 1 from public.crm_tag_aliases() a where a.alias <> lower(a.alias) or a.tag <> lower(a.tag)) then raise exception 'w294live: an alias is not lower case'; end if;
  if not exists (select 1 from public.crm_tag_aliases() a where a.alias = 'volunteer server' and a.tag = 'server') then raise exception 'w294live: volunteer server does not find server'; end if;

  -- batch 7 on invented people, in this transaction only
  update public.app_config set value = '{}' where key = 'keela_keys';
  v_run := public.wa284_new_run('W294 live check', 'w294live');
  v_kid := 'W294LIVE-' || v_run; v_mail := 'w294.live.' || v_run || '@example.invalid';   -- unique per run, so a second pass in the same block meets its own person
  insert into public.crm_contacts (full_name, emails, tags, legacy_refs)
  values ('W294 Live Person ' || v_run, array[v_mail], '{}', jsonb_build_object('keela', jsonb_build_object('contact_id', v_kid))) returning id into v_c;
  v_file := public.wa284_register(v_run, v_run || '/w294live-contacts.json', 'keela_contacts_json');
  perform public.wa284_stage_rows(v_file, 0, jsonb_build_array(jsonb_build_object('Contact Id', v_kid, 'Contact Type', 'Individual', 'Primary Email', v_mail,
     'Tags', jsonb_build_array('Volunteer Server', 'Server', 'Donor', 'Past Donor', 'Reoccurring Donor', 'WA Admin 2026', 'W294 Live Unmapped'))), 1);
  b := public.wa284_new_batch(v_run, 'participation');
  r := public.wa284_compare(b, 'w294live');
  if (select status from public.crm_import_batches where id = b) <> 'compared' then raise exception 'w294live: the participation compare failed: %', (select error from public.crm_import_batches where id = b); end if;
  if r::text ~ '(@|W294 Live Person)' then raise exception 'w294live: the report holds a value'; end if;
  r := public.wa284_apply(b, 'w294live');
  select tags into v_t from public.crm_contacts where id = v_c;
  if cardinality(v_t) <> 6 or not (v_t @> array['W294 Live Unmapped', 'donor', 'past donor', 'recurring donor', 'server', 'wa admin']) then
    raise exception 'w294live: the tags after batch 7 are not the Hub tags';
  end if;
  r := public.wa284_undo(b, 'w294live');
  if (select tags from public.crm_contacts where id = v_c) <> '{}'::text[] then raise exception 'w294live: undo left tags behind'; end if;
  perform public.wa284_purge(v_run);
end $live$;

-- wave284: checks on the live database, after build/data/wa281_rules.sql, build/data/wa283_page.sql and build/data/wa284_import.sql. Runs only
-- inside the block build/sql_rollback_test.py prints, so everything rolls back. No transaction control. Raises on the first failure with the
-- check's name only; personal data never leaves the database. The flow works on invented people only (Keela ids W284LIVE-..., addresses at
-- example.invalid, 555 numbers): it stages them, compares and applies every kind of batch against the live tables (so the side-effect guard
-- meets the live triggers), and undoes the undoable ones. Batch 2 (legacy_fields) is compared on the live contacts' Keela fields and rolled back
-- by its own compare; only its status is checked. Proved offline first by test/w284sql.mjs on the fixture.

do $live$
declare
  t text; n bigint; f record; v_run bigint; v_contacts bigint; v_resp bigint; b bigint; r jsonb; v_kind text; v_t0 timestamptz; v_p1 bigint; v_p2 bigint;
begin
  -- structure
  foreach t in array array['public.crm_import_runs', 'public.crm_import_batches', 'public.crm_import_changes', 'import_stage.files', 'import_stage.rows'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'w284live: % has no row level security', t; end if;
    if has_table_privilege('anon', t, 'select') then raise exception 'w284live: anon can read %', t; end if;
  end loop;
  foreach t in array array['public.crm_import_runs', 'public.crm_import_batches', 'public.crm_import_changes'] loop
    if (select string_agg(polcmd::text || ':' || pg_get_expr(polqual, polrelid), ',') from pg_policy where polrelid = t::regclass) <> 'r:wa_can(''import_admin''::text)' then
      raise exception 'w284live: % does not have exactly the admin read policy', t;
    end if;
    if has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'update') or has_table_privilege('authenticated', t, 'delete') then
      raise exception 'w284live: signed-in users can write %', t;
    end if;
  end loop;
  foreach t in array array['anon', 'authenticated', 'service_role'] loop
    if has_schema_privilege(t, 'import_stage', 'usage') then raise exception 'w284live: % can use import_stage', t; end if;
  end loop;
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa284\_%' loop
    if has_function_privilege('anon', f.sig, 'execute') or has_function_privilege('authenticated', f.sig, 'execute') then
      raise exception 'w284live: % is executable by anon or authenticated', f.sig;
    end if;
    if f.proname <> 'wa284_import_guard' and not has_function_privilege('service_role', f.sig, 'execute') then raise exception 'w284live: the service role cannot run %', f.sig; end if;
  end loop;
  if (select count(*) from pg_trigger where tgname = 'trg_wa284_import_guard' and not tgisinternal) <> 9 then raise exception 'w284live: the guard trigger is not on the nine tables'; end if;
  if not exists (select 1 from storage.buckets where id = 'imports' and not public and file_size_limit = 104857600) then raise exception 'w284live: the imports bucket is not private with 100 MB'; end if;
  if (select count(*) from pg_policy where polrelid = 'storage.objects'::regclass and polname like 'wa284_imports_%') <> 3 then raise exception 'w284live: the three storage policies are missing'; end if;
  if (select count(*) from public.app_config where key in ('keela_assignee_map', 'keela_org_pairs_ok', 'keela_company_category_map', 'keela_status_map', 'keela_tag_map', 'keela_keys', 'keela_campaign_types')) <> 7 then
    raise exception 'w284live: the mapping settings are missing';
  end if;

  -- a run on invented people
  update public.app_config set value = '{"subscription_history": "Subscription History"}' where key = 'keela_keys';
  v_run := public.wa284_new_run('W284 live check', 'w284live');
  v_contacts := public.wa284_register(v_run, v_run || '/w284live-contacts.json', 'keela_contacts_json');
  perform public.wa284_stage_rows(v_contacts, 0, $j$[
    {"Contact Id": "W284LIVE-P1", "Contact Type": "Individual", "Full Name": "W284 Live Person One", "First Name": "W284", "Last Name": "Live One",
     "Primary Email": "w284.live.one@example.invalid", "Primary Phone": "555-284-0101", "Street": "", "Street Line 2": "", "City": "Montréal", "Province": "QC",
     "Postal Code": "", "Country": "Canada", "Notes": "W284 live note", "Title": "W284 Tester", "Birth Date": "2000-01-02", "Car: \"Make, Model, Type\"": "",
     "LinkedIn": "", "Food Licensing Certification": "", "Tags": ["Rally Paper Participant", "W284 Live Tag"], "Companies": "W284 Live Check Org",
     "Company Type": "", "Status": "", "Goal": "",
     "Subscription History": [{"date": "2025-01-05", "type": "Email Opted In", "form_name": "W284 Live Form"}, {"date": "2025-01-06", "type": "Text Opted In", "form_name": "W284 Live Form"}]},
    {"Contact Id": "W284LIVE-P2", "Contact Type": "Individual", "Full Name": "W284 Live Person Two", "First Name": "", "Last Name": "", "Primary Email": "w284.live.two@example.invalid",
     "Primary Phone": "", "Street": "", "Street Line 2": "", "City": "", "Province": "", "Postal Code": "", "Country": "", "Notes": "", "Title": "", "Birth Date": "",
     "Car: \"Make, Model, Type\"": "", "LinkedIn": "", "Food Licensing Certification": "", "Tags": [], "Companies": "", "Company Type": "", "Status": "", "Goal": "",
     "Subscription History": [{"date": "2025-01-05", "type": "Email Opted In", "form_name": "W284 Live Form"}, {"date": "2025-02-01", "type": "Email Unsubscribed", "form_name": null}]},
    {"Contact Id": "W284LIVE-C1", "Contact Type": "Company", "Full Name": "W284 Live Check Org", "Company Type": "", "Status": "Developing", "Goal": "W284 goal"}
  ]$j$::jsonb, 3);
  v_resp := public.wa284_register(v_run, v_run || '/w284live-responses.json', 'keela_responses_json');
  perform public.wa284_stage_rows(v_resp, 0, $j$[
    {"Response Id": "W284LIVE-R1", "Form Name": "W284 Live Toronto Form", "Contact Id": "W284LIVE-P1", "Email": "w284.live.one@example.invalid", "Submitted Date": "2025-05-01",
     "Answers": {"W284 question": "W284 answer", "Date of birth": "2000-01-02"}}
  ]$j$::jsonb, 1);
  if not exists (select 1 from public.wa284_keys(v_contacts) k where k.key = 'Contact Id' and k.filled = 3) then raise exception 'w284live: the keys of the staged file'; end if;

  -- every batch: compare (live tables unchanged by it), then apply; legacy_fields is compared only
  foreach v_kind in array array['people', 'optouts', 'legacy_fields', 'fields', 'orgs', 'consent', 'participation', 'form_answers'] loop
    b := public.wa284_new_batch(v_run, v_kind);
    v_t0 := clock_timestamp();
    r := public.wa284_compare(b, 'w284live');
    if (select status from public.crm_import_batches where id = b) <> 'compared' then
      raise exception 'w284live: % compare failed: %', v_kind, (select error from public.crm_import_batches where id = b);
    end if;
    if clock_timestamp() - v_t0 > interval '60 seconds' then raise exception 'w284live: % compare took more than a minute', v_kind; end if;
    if r::text ~ '(@|555-284|2000-01-02|W284 live note|W284 answer)' then raise exception 'w284live: the % report holds a value', v_kind; end if;
    if v_kind <> 'legacy_fields' then
      r := public.wa284_apply(b, 'w284live');
      if (select status from public.crm_import_batches where id = b) <> 'applied' then raise exception 'w284live: % did not apply', v_kind; end if;
    end if;
    if v_kind = 'people' then
      select id into v_p1 from public.crm_contacts where legacy_refs -> 'keela' ->> 'contact_id' = 'W284LIVE-P1';
      select id into v_p2 from public.crm_contacts where legacy_refs -> 'keela' ->> 'contact_id' = 'W284LIVE-P2';
      if v_p1 is null or v_p2 is null then raise exception 'w284live: people did not create the two invented contacts'; end if;
    end if;
  end loop;
  if (select email_status from public.crm_contacts where id = v_p2) <> 'unsubscribed' then raise exception 'w284live: the opt-out was not applied'; end if;
  if (select email_consent from public.crm_contacts where id = v_p1) is distinct from 'express' or (select sms_consent from public.crm_contacts where id = v_p1) is distinct from 'express' then
    raise exception 'w284live: the consent batch';
  end if;
  if not exists (select 1 from public.crm_contact_private where contact_id = v_p1) then raise exception 'w284live: the private birth date'; end if;
  if exists (select 1 from public.crm_import_changes c join public.crm_import_batches x on x.id = c.batch_id
              where x.run_id = v_run and coalesce(c.old_value::text, '') || coalesce(c.new_value::text, '') like '%2000-01-02%') then
    raise exception 'w284live: a birth date reached the change records';
  end if;
  if (select body from public.crm_interactions where source_ref = 'keela:W284LIVE-R1') <> 'W284 question: W284 answer' then raise exception 'w284live: the form answer'; end if;
  if not exists (select 1 from public.crm_contact_chapters where contact_id = v_p1 and chapter = 'toronto') then raise exception 'w284live: the Toronto chapter'; end if;
  if not exists (select 1 from public.wa_campaign_people p join public.wa_campaigns c on c.id = p.campaign_id where c.name = 'Rally Paper 2026' and p.contact_id = v_p1) then
    raise exception 'w284live: the Campaign row';
  end if;

  -- undo the undoable ones, newest first; optouts and consent refuse
  foreach v_kind in array array['form_answers', 'participation', 'orgs', 'fields', 'people'] loop
    select id into b from public.crm_import_batches where run_id = v_run and kind = v_kind;
    r := public.wa284_undo(b, 'w284live');
    if (select status from public.crm_import_batches where id = b) <> 'undone' then raise exception 'w284live: % did not undo', v_kind; end if;
  end loop;
  if exists (select 1 from public.crm_interactions where source_ref = 'keela:W284LIVE-R1') or exists (select 1 from public.crm_contact_private where contact_id = v_p1)
     or exists (select 1 from public.wa_campaign_people where contact_id = v_p1) or (select job_title from public.crm_contacts where id = v_p1) is not null then
    raise exception 'w284live: undo left something behind';
  end if;
  if not exists (select 1 from public.crm_contacts where id = v_p1) then raise exception 'w284live: undo deleted a contact'; end if;
  foreach v_kind in array array['optouts', 'consent'] loop
    select id into b from public.crm_import_batches where run_id = v_run and kind = v_kind;
    begin
      perform public.wa284_undo(b, 'w284live');
      raise exception 'w284live: % was undone', v_kind;
    exception when others then
      if sqlerrm not like 'wa284: the % batch is never undone%' then raise; end if;
    end;
  end loop;
  if cardinality(public.wa284_purge(v_run)) <> 2 then raise exception 'w284live: purge did not return the two paths'; end if;
  if exists (select 1 from import_stage.rows where run_id = v_run) then raise exception 'w284live: purge left staged rows'; end if;
end $live$;

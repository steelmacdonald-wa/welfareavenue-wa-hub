-- Welfare Avenue Hub: wave284. Assertions for build/data/wa284_import.sql (Phase 4 of the Hub CRM slice 1: the Import page).
-- Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w284schema.sql and the migration are loaded. Everything runs in one transaction and
-- ends with a rollback; any failed assertion raises. Offline: node test/w284sql.mjs (PGlite). Every row is invented (Test ..., example.com,
-- example.invalid, 555 numbers, Keela ids KT... and KC...). The net.http_request_queue guard is checked by test/w284sql.mjs (it needs a top-level call).

begin;
create temp table w284ids (k text primary key, v bigint);
create function pg_temp.id(p text) returns bigint language sql as $$ select v from w284ids where k = p $$;
create function pg_temp.md5_live() returns text language sql as $$
  select md5(concat_ws('|',
    (select string_agg(t::text, ',' order by t::text) from public.crm_contacts t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_contact_fields t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_contact_private t),
    (select string_agg(t::text, ',' order by t::text) from public.wa_partners t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_contact_orgs t),
    (select string_agg(t::text, ',' order by t::text) from public.wa_campaigns t),
    (select string_agg(t::text, ',' order by t::text) from public.wa_campaign_people t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_contact_chapters t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_interactions t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_consent_events t),
    (select string_agg(t::text, ',' order by t::text) from public.crm_import_changes t)))
$$;

-- ---------------------------------------------------------------- the structure
do $$
declare t text; n int; f record;
begin
  foreach t in array array['public.crm_import_runs', 'public.crm_import_batches', 'public.crm_import_changes', 'import_stage.files', 'import_stage.rows'] loop
    assert (select relrowsecurity from pg_class where oid = t::regclass), t || ' has row level security';
    assert not has_table_privilege('anon', t, 'select') and not has_table_privilege('anon', t, 'insert'), t || ': anon has nothing';
    assert obj_description(t::regclass, 'pg_class') is not null, t || ' has a comment';
    assert not exists (select 1 from pg_attribute a where a.attrelid = t::regclass and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null),
      t || ': every column has a comment';
  end loop;
  foreach t in array array['public.crm_import_runs', 'public.crm_import_batches', 'public.crm_import_changes'] loop
    assert has_table_privilege('authenticated', t, 'select') and not has_table_privilege('authenticated', t, 'insert')
       and not has_table_privilege('authenticated', t, 'update') and not has_table_privilege('authenticated', t, 'delete'), t || ': signed-in users may only read (row security decides)';
    assert (select string_agg(polcmd::text || ':' || polroles::regrole[]::text || ':' || pg_get_expr(polqual, polrelid), ',') from pg_policy where polrelid = t::regclass)
      = 'r:{authenticated}:wa_can(''import_admin''::text)', t || ': one policy, select for wa_can(import_admin), no write policies';
  end loop;
  foreach t in array array['anon', 'authenticated', 'service_role'] loop
    assert not has_schema_privilege(t, 'import_stage', 'usage'), 'import_stage: no usage for ' || t;
    assert not has_table_privilege(t, 'import_stage.rows', 'select'), 'import_stage.rows: no grant for ' || t;
  end loop;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa284\_%';
  assert n >= 40, 'the wa284_ functions are there (' || n || ')';
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa284\_%' loop
    assert not has_function_privilege('anon', f.sig, 'execute'), f.sig::text || ': anon cannot execute it';
    assert not has_function_privilege('authenticated', f.sig, 'execute'), f.sig::text || ': authenticated cannot execute it';
    assert f.proname = 'wa284_import_guard' or has_function_privilege('service_role', f.sig, 'execute'), f.sig::text || ': the service role can';
    assert obj_description(f.sig, 'pg_proc') like 'wave284:%', f.sig::text || ' has a comment';
  end loop;
  assert (select count(*) from pg_trigger where tgname = 'trg_wa284_import_guard' and not tgisinternal) = 9, 'the guard trigger is on the nine tables';
  assert (select string_agg(c.relname, ',' order by c.relname) from pg_trigger g join pg_class c on c.oid = g.tgrelid where g.tgname = 'trg_wa284_import_guard')
    = 'crm_automation_runs,crm_email_sends,crm_form_submissions,dept_requests,event_roster,hub_notifications_sent,quo_messages,volunteer_applications,whatsapp_messages', 'the nine guarded tables';
  assert (select not public and file_size_limit = 104857600 from storage.buckets where id = 'imports'), 'the bucket imports is private, 100 MB a file';
  assert (select string_agg(polname || ':' || polcmd::text, ',' order by polname) from pg_policy where polrelid = 'storage.objects'::regclass and polname like 'wa284%')
    = 'wa284_imports_delete:d,wa284_imports_insert:a,wa284_imports_select:r', 'insert, select and delete storage policies';
  assert (select bool_and(coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)) like '%imports%wa_can(''import_admin''::text)%')
            from pg_policy where polrelid = 'storage.objects'::regclass and polname like 'wa284%'), 'each storage policy is the imports bucket and wa_can(import_admin)';
  assert (select count(*) from public.app_config where key in ('keela_assignee_map', 'keela_org_pairs_ok', 'keela_company_category_map', 'keela_status_map', 'keela_tag_map', 'keela_keys', 'keela_campaign_types')) = 7,
    'the seven mapping settings';
  assert (select value::jsonb from public.app_config where key = 'keela_status_map') = '{"To contact": "prospect", "Developing": "prospect", "Established relationship": "active"}', 'the status map';
  assert (select value::jsonb -> 'Toronto Volunteers' ->> 'chapter' from public.app_config where key = 'keela_tag_map') = 'toronto' and
         (select (value::jsonb -> 'Reoccurring Donor' ->> 'skip')::boolean from public.app_config where key = 'keela_tag_map'), 'the tag map';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave284' and field = 'wave284') = 1, 'one release line';
end $$;

-- ---------------------------------------------------------------- signed in: authenticated reads the runs only as an admin, and calls no wa284_ function
insert into public.crm_import_runs (label, created_by) values ('Test probe run', 'test');
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$
declare v_err text;
begin
  assert (select count(*) from public.crm_import_runs) = 0, 'a member reads no runs';
  begin perform public.wa284_files(null); exception when insufficient_privilege then v_err := 'denied'; end;
  assert v_err = 'denied', 'authenticated cannot call a wa284_ function';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.crm_import_runs) >= 1, 'an admin reads the runs';
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.crm_import_runs where label = 'Test probe run';

-- ---------------------------------------------------------------- a run, a file, staging (the settings an admin fills in start as wave284 seeds them)
update public.app_config set value = '{}' where key in ('keela_keys', 'keela_assignee_map', 'keela_campaign_types');
update public.app_config set value = '[]' where key = 'keela_org_pairs_ok';
do $$
declare v_run bigint; v_file bigint; v_err text; r jsonb;
begin
  v_run := public.wa284_new_run('Test run', 'w281.admin@example.invalid');
  insert into w284ids values ('run', v_run);
  begin perform public.wa284_register(v_run, 'elsewhere/test.json', 'keela_contacts_json'); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: the file must be in the run''s folder%', 'a file outside the run''s folder is refused (' || coalesce(v_err, 'none') || ')';
  v_err := null;
  begin perform public.wa284_register(v_run, v_run || '/x.json', 'keela_people'); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: unknown file kind%', 'an unknown kind is refused';
  v_file := public.wa284_register(v_run, v_run || '/1-test-contacts.json', 'keela_contacts_json');
  insert into w284ids values ('contacts', v_file);
  -- restaging from 0 replaces the rows; a chunk out of order is refused
  r := public.wa284_stage_rows(v_file, 0, '[{"a": 1}, {"a": 2}, {"a": 3}]'::jsonb, 3);
  assert (r ->> 'staged_through')::int = 3 and (select count(*) from import_stage.rows where file_id = v_file) = 3, 'three rows staged';
  r := public.wa284_stage_rows(v_file, 0, '[{"b": 1}, {"b": 2}]'::jsonb, 2);
  assert (select count(*) from import_stage.rows where file_id = v_file) = 2 and not exists (select 1 from import_stage.rows where file_id = v_file and data ? 'a'),
    'staging from row 0 again replaces the file''s rows';
  v_err := null;
  begin perform public.wa284_stage_rows(v_file, 5, '[{"b": 3}]'::jsonb); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: rows are staged in order (the next row is 3)%', 'a chunk out of order is refused (' || coalesce(v_err, 'none') || ')';
  v_err := null;
  begin perform public.wa284_stage_rows(v_file, 0, '[1, 2]'::jsonb); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: every row must be an object%', 'rows must be objects';
end $$;

-- the Keela contacts export (export 15), staged in two chunks
do $$
declare v_file bigint := pg_temp.id('contacts'); r jsonb; kk record;
  v_rows jsonb := $j$[
  {"Contact Id": "KT001", "Contact Type": "Individual", "Full Name": "Test Alpha Keela", "First Name": "Alpha", "Last Name": "Keela", "Primary Email": "alpha@example.com",
   "Primary Phone": "514-555-0101", "Street": "1 Test Street", "Street Line 2": "Apt 2", "City": "Montréal", "Province": "QC", "Postal Code": "H0H 0H0", "Country": "Canada",
   "Notes": "Likes cooking", "Title": "Chef", "Birth Date": "1990-04-02", "Car: \"Make, Model, Type\"": "Test Car Sedan", "LinkedIn": "linkedin.com/in/test-alpha",
   "Food Licensing Certification": "interested", "Tags": ["Rally Paper Participant", "Toronto Volunteers", "Newsletter Fan", "Donor"], "Companies": "Test Bakery Inc.",
   "Company Type": "", "Status": "", "Goal": "",
   "Subscription History": [{"date": "2025-01-05", "type": "Email Opted In", "form_name": "Test Signup Form"}, {"date": "2025-06-01", "type": "Email Unsubscribed", "form_name": null}]},
  {"Contact Id": "KT002", "Contact Type": "Individual", "Full Name": "Test Beta", "First Name": "Beta", "Last Name": "Test", "Primary Email": "beta@example.com", "Primary Phone": "",
   "City": "Laval", "Birth Date": "1985-01-01", "Tags": "Flag Football 2025",
   "Subscription History": [{"date": "2025-03-01", "type": "Email Opted In", "form_name": "Test Signup Form"}]},
  {"Contact Id": "KT003", "Contact Type": "Individual", "Full Name": "Test Gamma", "Primary Email": "gamma2@example.com", "Primary Phone": "(514) 555-0303", "Subscription History": []},
  {"Contact Id": "KT004", "Contact Type": "Individual", "Full Name": "Test Delta", "Primary Email": "delta@example.com",
   "Subscription History": [{"date": "2025-02-01", "type": "Email Opted In", "form_name": "Test Form"}, {"date": "2025-08-01", "type": "Hard Bounce", "form_name": null}]},
  {"Contact Id": "KT005", "Contact Type": "Individual", "Full Name": "Test Epsilon", "Primary Email": "epsilon@example.com", "Birth Date": "not a date",
   "Notes": "Line one\nLigne deux é",
   "Subscription History": [{"date": "2025-02-02", "type": "Text Opted In", "form_name": "Test SMS Form"}, {"date": "2025-02-03", "type": "Email Opted In", "form_name": "Test Form"},
                            {"date": "sometime", "type": "Email Unsubscribed", "form_name": null}]},
  {"Contact Id": "KT006", "Contact Type": "Individual", "Full Name": "Test Zeta New", "Primary Email": "zeta@example.com", "Primary Phone": "514 555 0106", "Tags": ["Test Gala 2026"],
   "Subscription History": []},
  {"Contact Id": "KT007", "Contact Type": "Individual", "Full Name": "Test Eta Nothing"},
  {"Contact Id": "KT008", "Contact Type": "Individual", "Full Name": "Test Beta Duplicate", "Primary Email": " BETA@example.com "},
  {"Contact Id": "KC01", "Contact Type": "Company", "Full Name": "Test Bakery Inc.", "Company Type": "Business", "Goal": ["Sponsorship", "Item donations"]},
  {"Contact Id": "KC02", "Contact Type": "Company", "Full Name": "Test Alpha Keela"},
  {"Contact Id": "KC03", "Contact Type": "Company", "Full Name": "514-555-0199"},
  {"Contact Id": "KC04", "Contact Type": "Company", "Full Name": "Welfare Avenue"},
  {"Contact Id": "KC05", "Contact Type": "Company", "Full Name": "Test Foundation of Montreal"},
  {"Contact Id": "KC06", "Contact Type": "Company", "Full Name": "Test New Org", "Company Type": "Corporate", "Status": "Developing", "Goal": "Sponsorship"}
  ]$j$;
begin
  r := public.wa284_stage_rows(v_file, 0, (select jsonb_agg(e order by o) from jsonb_array_elements(v_rows) with ordinality x(e, o) where o <= 8), 14);
  assert (r ->> 'staged_through')::int = 8 and (r ->> 'rows')::int = 14, 'the first chunk: 8 of 14';
  r := public.wa284_stage_rows(v_file, 8, (select jsonb_agg(e order by o) from jsonb_array_elements(v_rows) with ordinality x(e, o) where o > 8));
  assert (r ->> 'staged_through')::int = 14 and (r ->> 'rows')::int = 14, 'the second chunk: 14 of 14';
  assert (select data ->> 'City' from import_stage.rows where file_id = v_file and row_no = 1) = 'Montréal'
     and (select data ->> 'Notes' from import_stage.rows where file_id = v_file and row_no = 5) = E'Line one\nLigne deux é', 'accents and multi-line notes survive staging';
  assert (select jsonb_agg(f ->> 'staged_through') from jsonb_array_elements(public.wa284_files(pg_temp.id('run'))) f) = '["14"]', 'wa284_files says 14 staged';
  -- the keys, with counts, never values
  assert exists (select 1 from public.wa284_keys(v_file) k where k.key = 'Contact Id' and k.filled = 14), 'keys: Contact Id 14';
  assert exists (select 1 from public.wa284_keys(v_file) k where k.key = 'Primary Phone' and k.filled = 3), 'keys: a blank value is not counted';
  assert exists (select 1 from public.wa284_keys(v_file) k where k.key = 'Subscription History[].date' and k.filled = 8), 'keys: the keys inside the subscription history';
  for kk in select * from public.wa284_keys(v_file) loop
    assert kk.key not like '%@%' and kk.key not like '%555%' and kk.key not like '%Test %', 'keys hold no values (' || kk.key || ')';
  end loop;
end $$;

-- ---------------------------------------------------------------- 1. optouts: compare changes nothing; apply; never undone
do $$
declare b bigint; v_md5 text; r jsonb; v_err text;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'optouts');
  insert into w284ids values ('optouts', b);
  assert public.wa284_new_batch(pg_temp.id('run'), 'optouts') = b, 'one batch per kind per run';
  r := public.wa284_compare(b);
  assert (select status from public.crm_import_batches where id = b) = 'failed'
     and (select error from public.crm_import_batches where id = b) like 'missing key subscription_history%', 'without the subscription history key the compare stops with missing key';
  update public.app_config set value = '{"subscription_history": "Subscription History"}' where key = 'keela_keys';
  v_md5 := pg_temp.md5_live();
  r := public.wa284_compare(b);
  assert pg_temp.md5_live() = v_md5, 'compare leaves the live tables unchanged';
  assert (select status from public.crm_import_batches where id = b) = 'compared', 'compared';
  assert r #>> '{counts,rows_read}' = '8' and r #>> '{counts,matched}' = '2' and r #>> '{counts,updated,email_status}' = '1' and r #>> '{counts,updated,consent_source}' = '1'
     and r #>> '{counts,skipped,already not emailed}' = '1', 'the optouts report: 8 read, 2 matched, one opt-out to write, one already not emailed (' || r::text || ')';
  assert (select report from public.crm_import_batches where id = b) = r, 'the report is stored';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select email_status from public.crm_contacts where id = 3001) = 'unsubscribed' and (select consent_source from public.crm_contacts where id = 3001) = 'Keela: unsubscribe 2025-06-01',
    'apply: the Keela unsubscribe is honoured with its source';
  assert (select count(*) from public.crm_consent_events where contact_id = 3001 and column_name = 'email_status' and source = 'Keela import' and import_batch_id = b) = 1,
    'the consent log records it as the Keela import, with the batch';
  assert (select status = 'applied' and applied_by = 'w281.admin@example.invalid' and applied_at is not null from public.crm_import_batches where id = b), 'applied, by whom';
  assert (select last_applied_at is not null from public.crm_import_runs where id = pg_temp.id('run')), 'the run knows when it was last applied';
  begin perform public.wa284_undo(b); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: the optouts batch is never undone%', 'undo refuses optouts (' || coalesce(v_err, 'none') || ')';
  v_err := null;
  begin perform public.wa284_compare(b); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: this batch is applied%', 'an applied batch is not compared again';
end $$;

-- ---------------------------------------------------------------- 2. legacy_fields (no upload)
do $$
declare b bigint; r jsonb; v_md5 text;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'legacy_fields'); insert into w284ids values ('legacy', b);
  v_md5 := pg_temp.md5_live();
  r := public.wa284_compare(b);
  assert pg_temp.md5_live() = v_md5, 'legacy_fields: compare leaves the live tables unchanged';
  assert r #>> '{counts,rows_read}' = (select count(*)::text from public.crm_contacts where merged_into is null and jsonb_typeof(legacy_refs -> 'keela') = 'object') and r -> 'lists' -> 'positions_unmapped' = '["Juggler"]'
     and r -> 'lists' -> 'assignees_unmapped' = '["Test Staff One", "Test Nobody"]' and r #>> '{counts,kept_hub_value,donor_readiness}' = '1',
    'legacy_fields: every contact with Keela fields read, positions mapped by label (Juggler listed), assignees listed until mapped, the Hub''s donor readiness kept (' || r::text || ')';
  update public.app_config set value = '{"Test Staff One": "901"}' where key = 'keela_assignee_map';
  r := public.wa284_compare(b);
  assert r -> 'lists' -> 'assignees_unmapped' = '["Test Nobody"]' and r #>> '{counts,updated,owner_member_id}' = '1', 'a mapped assignee becomes the owner';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select owner_member_id from public.crm_contacts where id = 3001) = 901, 'owner_member_id set';
  assert (select cf.value from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key = 'volunteer_positions') = '["Cook", "Server"]',
    'positions split on ", " and mapped (Volunteer Cook, Volunteer Server)';
  assert (select cf.value from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key = 'donor_readiness') = '"SP"', 'Shows potential is SP';
  assert (select cf.value from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key = 'dates_volunteered') = '"2025-06-01, 2025-07-06"',
    'dates volunteered is a field';
  assert (select cf.value from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3004 and f.key = 'donor_readiness') = '"NR"', 'the Hub''s value wins';
  -- a field changed after apply is kept and listed; the rest is undone
  update public.crm_contact_fields cf set value = '"2025-06-01"' from public.crm_fields f where f.id = cf.field_id and cf.contact_id = 3001 and f.key = 'dates_volunteered';
  r := public.wa284_undo(b, 'w281.admin@example.invalid');
  assert (select owner_member_id from public.crm_contacts where id = 3001) is null, 'undo: the owner is empty again';
  assert not exists (select 1 from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key in ('volunteer_positions', 'donor_readiness', 'rally_paper_team', 'volunteer_availability')),
    'undo: the fields it added are gone';
  assert exists (select 1 from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key = 'dates_volunteered' and cf.value = '"2025-06-01"'),
    'undo: the field changed since is kept';
  assert jsonb_array_length(r #> '{lists,changed_since_kept}') = 1 and r #>> '{lists,changed_since_kept,0,table}' = 'crm_contact_fields', 'and listed';
  assert (select status from public.crm_import_batches where id = b) = 'undone', 'undone';
end $$;

-- ---------------------------------------------------------------- 3. people: apply, a column changed after apply is kept and listed, undo restores the rest
do $$
declare b bigint; r jsonb; v_before text; v_new bigint;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'people'); insert into w284ids values ('people', b);
  select string_agg(t::text, ',' order by t.id) into v_before from (select id, first_name, last_name, address, city, phones, emails, primary_email, notes, legacy_refs from public.crm_contacts where id in (3001, 3002, 3003, 3004, 3005)) t;
  r := public.wa284_compare(b);
  assert r #>> '{counts,rows_read}' = '8' and r #>> '{counts,matched}' = '5' and r #>> '{counts,created}' = '1', 'people: 8 read, 5 matched, 1 new (' || r::text || ')';
  assert r -> 'lists' -> 'phone_only' = '[{"keela_id": "KT003", "contact_id": 3003}]', 'a phone-only match is listed, never merged';
  assert r -> 'lists' -> 'keela_ids_skipped' = '[{"reason": "no email or phone", "keela_id": "KT007"}]', 'a person with neither email nor phone is skipped and listed';
  assert r #>> '{counts,kept_hub_value,city}' = '1' and r #>> '{counts,kept_hub_value,full_name}' = '1', 'the Hub wins (city, a duplicate''s name)';
  assert r::text not like '%@%' and r::text not like '%555%' and r::text not like '%Test Street%' and r::text not like '%cooking%', 'the report holds no email, phone, address or note';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select first_name = 'Alpha' and last_name = 'Keela' and city = 'Montréal' and address = '1 Test Street, Apt 2' and phones = array['514-555-0101']
                 and notes = E'A Hub note\n\nFrom Keela: Likes cooking' from public.crm_contacts where id = 3001), 'apply: empty fields filled, the note appended, accents kept';
  assert (select city = 'Montreal' and last_name = 'Test' and legacy_refs -> 'keela' ->> 'contact_id' = 'KT002' and legacy_refs -> 'keela_extra_ids' = '["KT008"]' from public.crm_contacts where id = 3002),
    'the email match takes the Keela id; the Keela duplicate''s id goes into keela_extra_ids; the Hub''s city stays';
  assert (select phones = array['+1 514 555 0303'] and legacy_refs = '{}' from public.crm_contacts where id = 3003), 'the phone-only match is untouched';
  assert (select notes from public.crm_contacts where id = 3005) = E'From Keela: Line one\nLigne deux é', 'a multi-line note with an accent arrives whole';
  select id into v_new from public.crm_contacts where legacy_refs -> 'keela' ->> 'contact_id' = 'KT006';
  assert v_new is not null and (select source = 'keela' and emails = array['zeta@example.com'] and full_name = 'Test Zeta New' from public.crm_contacts where id = v_new), 'a new contact (source keela)';
  insert into w284ids values ('zeta', v_new);
  assert not exists (select 1 from public.crm_contacts where full_name = 'Test Eta Nothing'), 'nobody without an email or phone is created';
  -- a column changed after apply
  update public.crm_contacts set first_name = 'Changed by staff' where id = 3001;
  r := public.wa284_undo(b, 'w281.admin@example.invalid');
  assert (select first_name from public.crm_contacts where id = 3001) = 'Changed by staff', 'undo: the column changed since is kept';
  assert r -> 'lists' -> 'changed_since_kept' @> '[{"table": "crm_contacts", "row_id": "3001", "column": "first_name"}]', 'and listed';
  assert (select string_agg(t::text, ',' order by t.id) from (select id, case when id = 3001 then null else first_name end as first_name, last_name, address, city, phones, emails, primary_email, notes, legacy_refs
            from public.crm_contacts where id in (3001, 3002, 3003, 3004, 3005)) t) = v_before, 'undo: every other column is back as it was';
  assert r -> 'lists' -> 'created_review' = jsonb_build_array(jsonb_build_object('table', 'crm_contacts', 'row_id', v_new::text)) and exists (select 1 from public.crm_contacts where id = v_new),
    'undo: the new contact is listed for review, never deleted';
  -- applied again, for the batches that follow
  update public.crm_contacts set first_name = null where id = 3001;
  perform public.wa284_compare(b);
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select count(*) from public.crm_contacts where legacy_refs -> 'keela' ->> 'contact_id' = 'KT006') = 1, 'applied again: the new contact is matched by its Keela id, not created twice';
  assert (select count(*) from public.crm_import_changes where batch_id = b and action = 'insert') = 0, 'and the records of the undone apply were replaced';
end $$;

-- ---------------------------------------------------------------- 4. fields: no birth date in any change record; a birth-date row is removed only if unchanged
do $$
declare b bigint; r jsonb;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'fields'); insert into w284ids values ('fields', b);
  r := public.wa284_compare(b);
  assert r #>> '{counts,kept_hub_value,birth_date}' = '1' and r #>> '{counts,skipped,birth date not a date}' = '1', 'fields: an existing private row is kept; a wrong date is skipped (' || r::text || ')';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select birth_date from public.crm_contact_private where contact_id = 3001) = date '1990-04-02' and (select birth_date from public.crm_contact_private where contact_id = 3002) = date '1970-01-01',
    'the birth date goes into crm_contact_private; the Hub''s stays';
  assert (select job_title from public.crm_contacts where id = 3001) = 'Chef', 'the job title';
  assert (select cf.value from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key = 'food_licence') = '"Interested"', 'the food licence option';
  assert (select cf.value from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = 3001 and f.key = 'car_make_model') = '"Test Car Sedan"', 'the car';
  assert not exists (select 1 from public.crm_import_changes where coalesce(old_value::text, '') || coalesce(new_value::text, '') ~ '(1990-04-0|1985-01-01|1970-01-01)'), 'no birth date appears in crm_import_changes';
  assert (select new_value = '"set"' and old_value is null and sensitive from public.crm_import_changes where batch_id = b and table_name = 'crm_contact_private'), 'the birth date''s change record says "set"';
  assert not exists (select 1 from public.crm_import_batches where coalesce(report::text, '') ~ '(1990-04-0|1985-01-01|1970-01-01)'), 'and no report holds one';
  -- changed by HR after apply: undo keeps it
  update public.crm_contact_private set birth_date = '1990-04-03', source = 'set by HR in the CRM', updated_at = now() + interval '1 minute' where contact_id = 3001;
  r := public.wa284_undo(b, 'w281.admin@example.invalid');
  assert (select birth_date from public.crm_contact_private where contact_id = 3001) = date '1990-04-03' and r -> 'lists' -> 'changed_since_kept' @> '[{"table": "crm_contact_private", "row_id": "3001"}]',
    'undo keeps a birth date HR changed since, and lists it';
  assert (select job_title from public.crm_contacts where id = 3001) is null, 'undo: the job title is empty again';
  -- unchanged: undo removes it
  delete from public.crm_contact_private where contact_id = 3001;
  perform public.wa284_compare(b);
  perform public.wa284_apply(b, 'w281.admin@example.invalid');
  assert exists (select 1 from public.crm_contact_private where contact_id = 3001), 'applied again';
  perform public.wa284_undo(b, 'w281.admin@example.invalid');
  assert not exists (select 1 from public.crm_contact_private where contact_id = 3001) and exists (select 1 from public.crm_contact_private where contact_id = 3002),
    'undo removes the birth-date row it added (unchanged since), and only that one';
end $$;

-- ---------------------------------------------------------------- 5. orgs
do $$
declare b bigint; r jsonb; v_new bigint;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'orgs'); insert into w284ids values ('orgs', b);
  r := public.wa284_compare(b);
  assert r #>> '{counts,rows_read}' = '6' and r #>> '{counts,matched}' = '1' and r #>> '{counts,created}' = '1', 'orgs: 6 companies, 1 exact match, 1 created (' || r::text || ')';
  assert r -> 'lists' -> 'org_pairs' = '[{"keela_company_id": "KC05", "keela_name": "Test Foundation of Montreal", "partner_id": 4002, "partner_name": "Test Foundation"}]', 'the close pair is listed for a tick';
  assert r #>> '{counts,skipped,close pair not ticked}' = '1', 'and not linked yet';
  assert (select jsonb_agg(e ->> 'keela_id' order by e ->> 'keela_id') from jsonb_array_elements(r -> 'lists' -> 'keela_ids_skipped') e) = '["KC02", "KC03", "KC04"]',
    'a person''s name, a phone number and Welfare Avenue are skipped and listed by Keela id';
  assert r::text not like '%Test Alpha Keela%' and r::text not like '%555%', 'the report never names the person or the number';
  assert r -> 'lists' -> 'company_types_unmapped' = '["Corporate"]', 'an unmapped company type is listed';
  update public.app_config set value = '[{"keela_company_id": "KC05", "partner_id": 4002}]' where key = 'keela_org_pairs_ok';
  r := public.wa284_compare(b);
  assert r #>> '{counts,matched}' = '2' and r -> 'lists' -> 'org_pairs' = '[]', 'a ticked pair is linked';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select keela_company_id = 'KC01' and goals = array['Sponsorship', 'Item donations'] from public.wa_partners where id = 4001), 'the exact match is linked and its goals filled';
  assert (select keela_company_id from public.wa_partners where id = 4002) = 'KC05', 'the ticked pair is linked';
  select id into v_new from public.wa_partners where keela_company_id = 'KC06';
  assert (select name = 'Test New Org' and status = 'prospect' and category = 'partner' and visibility = 'everyone' and goals = array['Sponsorship'] from public.wa_partners where id = v_new),
    'a real new organisation: status from keela_status_map, visibility everyone, its goal';
  assert exists (select 1 from public.crm_contact_orgs where contact_id = 3001 and partner_id = 4001), 'the person is linked to the organisation';
  assert not exists (select 1 from public.wa_partners where name in ('Test Alpha Keela', '514-555-0199', 'Welfare Avenue')), 'nothing created for the skipped entries';
end $$;

-- ---------------------------------------------------------------- 6. consent: never undone
do $$
declare b bigint; r jsonb; v_err text;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'consent'); insert into w284ids values ('consent', b);
  r := public.wa284_compare(b);
  assert r #>> '{counts,updated,crm_consent_events}' = '7' and r #>> '{counts,skipped,undated event}' = '1', 'consent: 7 dated events into the log, the undated one left out (' || r::text || ')';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select count(*) from public.crm_consent_events where source = 'keela' and import_batch_id = b) = 7, 'the Keela events are in the consent log (source keela)';
  assert (select email_consent = 'express' and consent_source = 'Keela: opted in on Test Signup Form 2025-03-01' from public.crm_contacts where id = 3002), 'express consent with dated proof';
  assert (select email_consent is null and email_status = 'unsubscribed' from public.crm_contacts where id = 3001), 'never upgrades an unsubscribed address';
  assert (select email_consent is null from public.crm_contacts where id = 3004), 'nor a bounced or unsubscribed one';
  assert (select email_consent = 'express' and sms_consent = 'express' and sms_consent_source = 'Keela import' from public.crm_contacts where id = 3005), 'a text opt-in becomes sms_consent';
  begin perform public.wa284_undo(b); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: the consent batch is never undone%', 'undo refuses consent';
end $$;

-- ---------------------------------------------------------------- 7. participation: a campaign created with the type an admin picked; undo removes its own rows
do $$
declare b bigint; r jsonb; v_camp bigint;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'participation'); insert into w284ids values ('participation', b);
  update public.app_config set value = (value::jsonb || '{"Test Gala 2026": {"campaign": "Test Gala 2026", "part": "participant"}}')::text where key = 'keela_tag_map';
  r := public.wa284_compare(b);
  assert r -> 'lists' -> 'campaigns_to_create' = '["Test Gala 2026"]' and r #>> '{counts,created}' = '0', 'a campaign not yet in the Hub waits for its type (' || r::text || ')';
  update public.app_config set value = '{"Test Gala 2026": "fundraising_event"}' where key = 'keela_campaign_types';
  r := public.wa284_compare(b);
  assert r #>> '{counts,created}' = '1' and r #>> '{counts,updated,wa_campaign_people}' = '3' and r #>> '{counts,updated,crm_contact_chapters}' = '1'
     and r #>> '{counts,updated,tags}' = '1' and r #>> '{counts,skipped,tag skipped}' = '1', 'participation: three Campaign rows, a chapter, one tag, one skipped';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  select id into v_camp from public.wa_campaigns where name = 'Test Gala 2026';
  assert (select type = 'fundraising_event' and year = 2026 and keela_name = 'Test Gala 2026' from public.wa_campaigns where id = v_camp), 'the campaign, with the type picked';
  assert exists (select 1 from public.wa_campaign_people p join public.wa_campaigns c on c.id = p.campaign_id where c.name = 'Rally Paper 2026' and p.contact_id = 3001 and p.part = 'participant'),
    'Rally Paper Participant is Rally Paper 2026, participant';
  assert exists (select 1 from public.wa_campaign_people p join public.wa_campaigns c on c.id = p.campaign_id where c.name = 'Football Fundraiser 2025' and p.contact_id = 3002), 'Flag Football 2025';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 3001 and chapter = 'toronto' and source = 'import'), 'Toronto Volunteers is the Toronto chapter';
  assert (select tags from public.crm_contacts where id = 3001) = array['Newsletter Fan'], 'any other tag goes into tags[]; the donor tag is skipped';
  r := public.wa284_undo(b, 'w281.admin@example.invalid');
  assert not exists (select 1 from public.wa_campaign_people where source_ref = 'Keela import batch ' || b) and not exists (select 1 from public.crm_contact_chapters where contact_id = 3001),
    'undo removes its own rows';
  assert (select tags from public.crm_contacts where id = 3001) = '{}'::text[], 'and puts the tags back';
  assert exists (select 1 from public.wa_campaigns where id = v_camp) and r -> 'lists' -> 'created_review' @> jsonb_build_array(jsonb_build_object('table', 'wa_campaigns', 'row_id', v_camp::text)),
    'the new campaign is listed for review, never deleted';
end $$;

-- ---------------------------------------------------------------- 8. form_answers, and the guard that rolls back a writer which inserts a dept_requests row
do $$
declare v_file bigint; r jsonb;
begin
  v_file := public.wa284_register(pg_temp.id('run'), pg_temp.id('run') || '/2-test-responses.json', 'keela_responses_json');
  insert into w284ids values ('responses', v_file);
  r := public.wa284_stage_rows(v_file, 0, $j$[
    {"Response Id": "R001", "Form Name": "Test Volunteer Form", "Contact Id": "KT001", "Email": "alpha@example.com", "Submitted Date": "2025-05-01T10:00:00Z",
     "Answers": {"Why do you volunteer?": "To help", "Date of birth": "1990-04-02", "Home address": "1 Test Street", "Health notes": "none"}},
    {"Response Id": "R002", "Form Name": "Test Toronto Volunteer Form", "Contact Id": "KT005", "Submitted Date": "2025-05-02",
     "Answers": [{"question": "Shift", "answer": "Sunday"}, {"question": "Allergies", "answer": "peanuts"}]},
    {"Response Id": "R003", "Form Name": "Test earlier form", "Contact Id": "KT005", "Submitted Date": "2025-04-01", "Answers": {}},
    {"Response Id": "R004", "Form Name": "Test Volunteer Form", "Contact Id": "KT999", "Submitted Date": "2025-05-03", "Answers": {"Q": "A"}}
  ]$j$::jsonb, 4);
  assert (r ->> 'staged_through')::int = 4, 'the responses are staged';
end $$;
create function public.w284_test_side_effect() returns trigger language plpgsql as $$
begin insert into public.dept_requests (department, title) values ('operations', 'Test side effect'); return new; end $$;
create trigger w284_test_side_effect after insert on public.crm_interactions for each row execute function public.w284_test_side_effect();
do $$
declare b bigint; r jsonb; v_err text; n0 bigint; d0 bigint;
begin
  b := public.wa284_new_batch(pg_temp.id('run'), 'form_answers'); insert into w284ids values ('forms', b);
  n0 := (select count(*) from public.crm_interactions); d0 := (select count(*) from public.dept_requests);
  r := public.wa284_compare(b);
  assert (select status = 'failed' and error = 'import side effect blocked (dept_requests)' from public.crm_import_batches where id = b), 'compare: the guard stops a writer that files a request';
  drop trigger w284_test_side_effect on public.crm_interactions;
  r := public.wa284_compare(b);
  assert (select status from public.crm_import_batches where id = b) = 'compared', 'compared without the side effect';
  create trigger w284_test_side_effect after insert on public.crm_interactions for each row execute function public.w284_test_side_effect();
  begin perform public.wa284_apply(b, 'w281.admin@example.invalid'); exception when others then v_err := sqlerrm; end;
  assert v_err = 'import side effect blocked (dept_requests)', 'apply: the guard raises (' || coalesce(v_err, 'none') || ')';
  assert (select count(*) from public.crm_interactions) = n0 and (select count(*) from public.dept_requests) = d0 and (select status from public.crm_import_batches where id = b) = 'compared',
    'the guard rolls the whole batch back: no timeline item, no request, the batch still only compared';
  drop trigger w284_test_side_effect on public.crm_interactions;
end $$;
drop function public.w284_test_side_effect();
do $$
declare b bigint := pg_temp.id('forms'); r jsonb;
begin
  r := public.wa284_compare(b);
  assert r #>> '{counts,matched}' = '2' and r #>> '{counts,skipped,already in the Hub}' = '1' and r #>> '{counts,skipped,sensitive answer left out}' = '4'
     and r -> 'lists' -> 'keela_ids_skipped' = '[{"reason": "no Hub contact", "response_id": "R004"}]', 'form_answers: 2 new, 1 already in the Hub, 4 sensitive answers left out (' || r::text || ')';
  r := public.wa284_apply(b, 'w281.admin@example.invalid');
  assert (select subject = 'Test Volunteer Form' and body = 'Why do you volunteer?: To help' and kind = 'form' and direction = 'in' and channel = 'website' and source = 'keela'
                 and (occurred_at at time zone 'America/Toronto')::date = date '2025-05-01' and meta ->> 'type' = 'Form Response'
            from public.crm_interactions where source_ref = 'keela:R001'), 'a response becomes a timeline item in the first import''s shape, without the birth date, health or home address answers';
  assert (select body from public.crm_interactions where source_ref = 'keela:R002') = 'Shift: Sunday', 'allergies are health: left out';
  assert exists (select 1 from public.crm_contact_chapters where contact_id = 3005 and chapter = 'toronto'), 'a Toronto response adds the Toronto chapter';
  assert (select count(*) from public.crm_interactions where source_ref = 'keela:R003') = 1, 'nothing twice';
  r := public.wa284_undo(b, 'w281.admin@example.invalid');
  assert not exists (select 1 from public.crm_interactions where source_ref in ('keela:R001', 'keela:R002')) and not exists (select 1 from public.crm_contact_chapters where contact_id = 3005),
    'undo removes its own rows';
  assert (select count(*) from public.crm_interactions where source_ref = 'keela:R003') = 1, 'and only those';
end $$;

-- ---------------------------------------------------------------- the whole run: no birth date anywhere; purge
do $$
declare v_paths text[]; v_err text;
begin
  assert not exists (select 1 from public.crm_import_changes where coalesce(old_value::text, '') || coalesce(new_value::text, '') ~ '(1990-04-0|1985-01-01|1970-01-01)'),
    'no birth date in any change record';
  assert not exists (select 1 from public.crm_import_batches where coalesce(report::text, '') || coalesce(error, '') ~ '(@|1990-04|Test Street|cooking|peanuts)'),
    'no email, birth date, address, note or answer in any report or error';
  v_paths := public.wa284_purge(pg_temp.id('run'));
  assert v_paths = array[pg_temp.id('run') || '/1-test-contacts.json', pg_temp.id('run') || '/2-test-responses.json'], 'purge returns the two storage paths';
  assert not exists (select 1 from import_stage.rows where run_id = pg_temp.id('run')) and not exists (select 1 from import_stage.files where run_id = pg_temp.id('run'))
     and not exists (select 1 from public.crm_import_changes c join public.crm_import_batches b on b.id = c.batch_id where b.run_id = pg_temp.id('run')),
    'purge deletes the staged rows, the file records and the change records';
  assert (select purged_at is not null from public.crm_import_runs where id = pg_temp.id('run')), 'the run is marked purged';
  begin perform public.wa284_undo(pg_temp.id('orgs')); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: this run was purged%', 'a purged run''s batches cannot be undone';
  v_err := null;
  begin perform public.wa284_new_batch(pg_temp.id('run'), 'people'); exception when others then v_err := sqlerrm; end;
  assert v_err like 'wa284: there is no open run%', 'nor given new batches';
end $$;

select 'w284sql: all assertions passed' as result;
rollback;

-- wave289: checks on the live database, after slice 1 (build/data/wa281_rules.sql to wa288_toronto.sql) and build/data/wa289_scan.sql. Runs only
-- inside the block build/sql_rollback_test.py prints, so everything rolls back. No transaction control. Raises on the first failure with the check's
-- name only; personal data never leaves the database. The flow works on invented people only (gmail ids w289LIVE..., addresses at example.invalid):
-- it starts a hub-only run, stages ids and headers, dedupes, reads a thread, groups, types, looks, and checks that status holds no address.
-- Proved offline first by test/w289sql.mjs on the fixture.

do $live$
declare t text; f record; v_run bigint; r jsonb; n bigint;
begin
  -- structure
  foreach t in array array['public.crm_mail_scans', 'public.crm_email_suppressions', 'import_stage.mail_messages', 'import_stage.mail_people', 'import_stage.mail_orgs',
                           'import_stage.mail_seen', 'import_stage.mail_left_alone'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'w289live: % has no row level security', t; end if;
    if has_table_privilege('anon', t, 'select') then raise exception 'w289live: anon can read %', t; end if;
  end loop;
  foreach t in array array['import_stage.mail_messages', 'import_stage.mail_people', 'import_stage.mail_orgs', 'import_stage.mail_seen', 'import_stage.mail_left_alone'] loop
    if has_table_privilege('authenticated', t, 'select') or has_table_privilege('service_role', t, 'select') then raise exception 'w289live: % is readable directly', t; end if;
  end loop;
  foreach t in array array['public.crm_mail_scans', 'public.crm_email_suppressions'] loop
    if (select string_agg(polcmd::text || ':' || pg_get_expr(polqual, polrelid), ',') from pg_policy where polrelid = t::regclass) <> 'r:wa_can(''import_admin''::text)' then
      raise exception 'w289live: % does not have exactly the admin read policy', t;
    end if;
    if has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'update') or has_table_privilege('authenticated', t, 'delete') then
      raise exception 'w289live: signed-in users can write %', t;
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa289\_%' loop
    if has_function_privilege('anon', f.sig, 'execute') or has_function_privilege('authenticated', f.sig, 'execute') then raise exception 'w289live: % is executable by anon or authenticated', f.sig; end if;
  end loop;
  if (select count(*) from public.ai_routes where task like 'mail\_history\_%' and provider ->> 'data_collection' = 'deny') <> 4 then raise exception 'w289live: the four routes do not carry the provider setting'; end if;
  if exists (select 1 from jsonb_array_elements_text(public.wa289_ready()) p where p like '%provider%' or p like '%missing%') then raise exception 'w289live: ready reports a route or provider problem'; end if;
  if (select count(*) from public.app_config where key like 'mail\_history\_%' or key = 'mail_insights_quiet_months') < 18 then raise exception 'w289live: settings missing'; end if;
  if exists (select 1 from public.crm_mail_scans) then raise exception 'w289live: a scan already exists on live'; end if;

  -- the flow, on invented people
  v_run := public.wa289_new_run('w289live check', 'w289live', array['hub']);
  r := public.wa289_stage_ids(v_run, 'hub', '[{"id": "w289LIVE0001", "thread": "w289LIVEt1"}, {"id": "w289LIVE0002", "thread": "w289LIVEt1"}, {"id": "w289LIVE0003", "thread": "w289LIVEt2"}]', 'w289LIVEtok');
  if r <> '{"done": 0, "added": 3}' then raise exception 'w289live: stage_ids'; end if;
  r := public.wa289_save_headers(v_run, 'hub', jsonb_build_array(
    jsonb_build_object('id', 'w289LIVE0001', 'thread', 'w289LIVEt1', 'state', 'kept', 'direction', 'in', 'box', 'info', 'writer', 'w289live.writer@example.invalid', 'writer_name', 'W289 Live Writer',
                       'outside', jsonb_build_array('w289live.writer@example.invalid'), 'subject', 'Live check', 'msg_md5', md5('<w289live1@example.invalid>' || clock_timestamp()::text), 'sent_at', '2021-01-01T00:00:00Z'),
    jsonb_build_object('id', 'w289LIVE0002', 'thread', 'w289LIVEt1', 'state', 'kept', 'direction', 'out', 'box', 'hub', 'outside', jsonb_build_array('w289live.writer@example.invalid', 'w289live.cc@example.invalid'),
                       'recipients', jsonb_build_array('w289live.writer@example.invalid', 'w289live.cc@example.invalid'), 'subject', 'Live check', 'msg_md5', md5('<w289live2@example.invalid>' || clock_timestamp()::text), 'sent_at', '2021-01-02T00:00:00Z'),
    jsonb_build_object('id', 'w289LIVE0003', 'thread', 'w289LIVEt2', 'state', 'skipped', 'reason', 'bounce', 'sent_at', '2021-01-03T00:00:00Z')));
  if r <> '{"saved": 3}' then raise exception 'w289live: save_headers'; end if;
  perform public.wa289_scan_set(v_run, null, '{"phase": "dedupe"}');
  r := public.wa289_dedupe(v_run);
  if (r ->> 'duplicate')::int <> 0 or (r ->> 'internal')::int <> 0 then raise exception 'w289live: dedupe'; end if;
  perform public.wa289_save_bounce(v_run, 'hub', 'w289LIVE0003', 'w289live.gone@example.invalid', '5.1.1');
  perform public.wa289_scan_set(v_run, null, '{"phase": "threads"}');
  r := public.wa289_save_thread(v_run, 'hub', 'w289LIVEt1', '{"leave_out": "none", "topic": "volunteering", "lang": "en", "emails": [{"id": "w289LIVE0001", "line": "Asks how to volunteer", "asks_to_stop": false}]}', 0);
  perform public.wa289_scan_set(v_run, null, '{"phase": "people"}');
  r := public.wa289_group(v_run);
  if r <> '{"optouts": 1, "writers": 1, "suppressed": 0, "outbound_only": 1}' then raise exception 'w289live: group %', r::text; end if;
  if (select match_kind from import_stage.mail_people where run_id = v_run and key = 'w289live.writer@example.invalid') <> 'none' then raise exception 'w289live: an invented address matched a contact'; end if;
  perform public.wa289_save_person(v_run, 'w289live.writer@example.invalid', 'volunteer', 0.7, 0);
  r := public.wa289_people(v_run, '{}', 0, 'w289live@example.invalid');
  if (r ->> 'total')::int <> 2 then raise exception 'w289live: people'; end if;
  r := public.wa289_status(v_run);
  if r::text like '%@%' then raise exception 'w289live: status holds an address'; end if;
  if public.wa289_pump(true) <> 'on' then raise exception 'w289live: pump on'; end if;
  if not exists (select 1 from cron.job where jobname = 'wa-mail-history-pump') then raise exception 'w289live: pump scheduled'; end if;
  perform public.wa289_pump(false);
  if exists (select 1 from cron.job where jobname = 'wa-mail-history-pump') then raise exception 'w289live: pump off'; end if;
  -- leave nothing behind even inside the rolled-back block: the run (and its staging) go, and mail_seen and mail_left_alone hold no live-check rows
  delete from import_stage.mail_seen where run_id = v_run;
  delete from public.crm_import_runs where id = v_run;
  select count(*) into n from import_stage.mail_messages where run_id = v_run;
  if n <> 0 then raise exception 'w289live: staging not cleared with the run'; end if;
  raise notice 'w289live: every check passed';
end $live$;

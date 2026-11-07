-- Welfare Avenue Hub: wave289. Assertions for build/data/wa289_scan.sql (the email history scan's database).
-- Assumes test/w281schema.sql, build/data/wa281_rules.sql, test/w284schema.sql, build/data/wa284_import.sql, test/w289schema.sql and the migration
-- are loaded. Everything runs in one transaction and ends with a rollback; any failed assertion raises. Offline: node test/w289sql.mjs (PGlite).
-- Every person, address, subject and id is invented (Test ..., example.org, example.invalid, gmail ids gmailT...).

begin;
create temp table w289ids (k text primary key, v bigint);
create function pg_temp.id(p text) returns bigint language sql as $$ select v from w289ids where k = p $$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;

-- ---------------------------------------------------------------- the structure
do $$
declare t text; f record;
begin
  foreach t in array array['public.crm_mail_scans', 'public.crm_email_suppressions', 'import_stage.mail_messages', 'import_stage.mail_people', 'import_stage.mail_orgs',
                           'import_stage.mail_seen', 'import_stage.mail_left_alone'] loop
    assert (select relrowsecurity from pg_class where oid = t::regclass), t || ' has row level security';
    assert not has_table_privilege('anon', t, 'select') and not has_table_privilege('anon', t, 'insert'), t || ': anon has nothing';
    assert obj_description(t::regclass, 'pg_class') is not null, t || ' has a comment';
    assert not exists (select 1 from pg_attribute a where a.attrelid = t::regclass and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null), t || ': every column has a comment';
  end loop;
  foreach t in array array['import_stage.mail_messages', 'import_stage.mail_people', 'import_stage.mail_orgs', 'import_stage.mail_seen', 'import_stage.mail_left_alone'] loop
    assert not has_table_privilege('authenticated', t, 'select') and not has_table_privilege('service_role', t, 'select'), t || ': no role reads staging directly';
    assert not exists (select 1 from pg_attribute a where a.attrelid = t::regclass and a.attnum > 0 and not a.attisdropped
                        and a.attname in ('body', 'text', 'snippet', 'html', 'body_text', 'page_text', 'quoted')), t || ': no body, snippet or page-text column';
  end loop;
  foreach t in array array['public.crm_mail_scans', 'public.crm_email_suppressions'] loop
    assert has_table_privilege('authenticated', t, 'select') and not has_table_privilege('authenticated', t, 'insert')
       and not has_table_privilege('authenticated', t, 'update') and not has_table_privilege('authenticated', t, 'delete'), t || ': signed-in users may only read';
    assert (select string_agg(polcmd::text || ':' || polroles::regrole[]::text || ':' || pg_get_expr(polqual, polrelid), ',') from pg_policy where polrelid = t::regclass)
      = 'r:{authenticated}:wa_can(''import_admin''::text)', t || ': one policy, select for wa_can(import_admin)';
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa289\_%' loop
    assert not has_function_privilege('anon', f.sig, 'execute') and not has_function_privilege('authenticated', f.sig, 'execute'), f.sig::text || ' is the service role''s only';
    assert has_function_privilege('service_role', f.sig, 'execute'), f.sig::text || ' runs for the service role';
    assert obj_description(f.sig::oid, 'pg_proc') is not null, f.sig::text || ' has a comment';
  end loop;
  assert col_description('public.crm_import_runs'::regclass, (select attnum from pg_attribute where attrelid = 'public.crm_import_runs'::regclass and attname = 'source')) is not null, 'source has a comment';
  assert (select count(*) from public.ai_routes where task like 'mail\_history\_%' and provider ->> 'data_collection' = 'deny' and provider ->> 'zdr' = 'true') = 4, 'four mail_history routes carry the no-retention setting';
  assert (select count(*) from public.ai_routes where task in ('mail_history_thread', 'mail_history_insight') and system_add = (select system_add from public.ai_routes where task = 'reel')) = 2,
    'the two wording routes copy reel''s confidentiality rule';
  assert (select count(*) from public.app_config where (key like 'mail\_history\_%' or key = 'mail_insights_quiet_months')) = 18, 'the eighteen mail_ settings';
  assert public.wa289_ready() = '[]'::jsonb, 'ready when the routes carry the provider setting and the rule (' || public.wa289_ready()::text || ')';
end $$;

-- ready reports a missing provider setting and a missing rule, as sentences, without values
do $$
begin
  update public.ai_routes set provider = null where task = 'mail_history_org';
  update public.ai_routes set system_add = null where task = 'mail_history_thread';
  assert public.wa289_ready() = '["route mail_history_org has no no-retention provider setting", "route mail_history_thread has no confidentiality rule (system_add)"]'::jsonb, 'ready lists both problems: ' || public.wa289_ready()::text;
  update public.ai_routes set provider = '{"data_collection": "deny", "zdr": true}' where task = 'mail_history_org';
  update public.ai_routes set system_add = (select system_add from public.ai_routes where task = 'reel') where task = 'mail_history_thread';
end $$;

-- ---------------------------------------------------------------- small helpers
do $$
begin
  assert public.wa289_vote(array['A', 'B', 'A']) = 'A' and public.wa289_vote(array['B', 'A', 'A', 'B']) = 'B', 'a value seen twice wins, the latest first';
  assert public.wa289_vote(array['A', 'B']) is null and public.wa289_vote(array['A', null]) = 'A' and public.wa289_vote(array['A', 'A']) = 'A', 'a single value wins only alone';
  assert public.wa289_in_list('hotmail.ca', '["hotmail"]') and public.wa289_in_list('mail.gmail.com', '["gmail.com"]') and not public.wa289_in_list('org.example.org', '["gmail.com", "hotmail"]'), 'the list check';
  assert public.wa289_internal('anyone@welfareavenue.com') and public.wa289_internal('w284.staff@example.invalid') and public.wa289_internal('W289.Staff.Home@example.invalid')
     and not public.wa289_internal('test.writer@example.org'), 'internal addresses: our domain, team members, aliases';
  assert public.wa289_body_keys('{"a": [{"x": {"Body": 1}}]}') and not public.wa289_body_keys('{"subject": "x", "sig": {"name": "y"}}'), 'body-like keys at any depth';
end $$;

-- ---------------------------------------------------------------- the match (5.6)
do $$
begin
  assert public.wa289_match('Existing.Writer@org.example.org ') = '{"id": 4001, "kind": "email"}', 'by email, as wa284_contact: ' || public.wa289_match('existing.writer@org.example.org')::text;
  assert public.wa289_match('moved.writer@example.org') = '{"id": 4003, "kind": "merged"}', 'a merged contact is followed to the active record';
  assert public.wa289_match('nobody@example.org', '(514) 555-0177') = '{"id": 4004, "kind": "phone_only"}', 'a phone match is listed as phone_only';
  assert public.wa289_match('nobody@example.org', '555') = '{"id": null, "kind": "none"}', 'no match';
  assert public.wa289_match('w289.staff.home@example.invalid') = '{"id": 4005, "kind": "internal"}', 'a team member''s contact is internal';
  assert pg_temp.err($q$select public.wa289_match('loop.writer@example.org')$q$) like 'wa284: email history: merge loop at contact %', 'a merge loop stops';
end $$;

-- ---------------------------------------------------------------- a run: start, count, headers
do $$
declare v_run bigint; r jsonb;
begin
  v_run := public.wa289_new_run('Test history', 'w281.admin@example.invalid', array['steel', 'hub']);
  insert into w289ids values ('run', v_run);
  assert (select source from public.crm_import_runs where id = v_run) = 'email_history', 'the run''s source';
  assert (select count(*) from public.crm_mail_scans where run_id = v_run and phase = 'count' and cap_usd = 0.25) = 2, 'a scan per mailbox at count, capped at the sample cap';
  assert pg_temp.err($q$select public.wa289_new_run('Another', 'x', null)$q$) like '%another scan is still running%', 'one unfinished scan at a time';
  assert pg_temp.err($q$select public.wa289_new_run('Bad', 'x', array['info'])$q$) like '%mailboxes must be steel, hub or both%', 'only the allow-listed mailboxes';
  -- an id already imported, one left alone and one seen in an earlier run are done at once
  insert into public.crm_interactions (contact_id, kind, source, source_ref) values (4001, 'email', 'gmail', 'hub:gmailTDONE01:abc123');
  insert into import_stage.mail_left_alone (mailbox, gmail_id, why) values ('steel', 'gmailTLEFT01', 'personal');
  insert into import_stage.mail_seen (msg_md5, mailbox, gmail_id, run_id) values (md5('<old@example.invalid>'), 'hub', 'gmailTSEEN01', null);
  r := public.wa289_stage_ids(v_run, 'steel', '[{"id": "gmailSKIP0001", "thread": "thrS1"}, {"id": "gmailTIN0001", "thread": "thrA"}, {"id": "gmailTOUT001", "thread": "thrA"},
        {"id": "gmailTIN0002", "thread": "thrB"}, {"id": "gmailTLEFT01", "thread": "thrL"}, {"id": "gmailTBIG001", "thread": "thrC"}, {"id": "gmailTINT001", "thread": "thrD"},
        {"id": "gmailTDLV001", "thread": "thrE"}, {"id": "gmailTBAD002", "thread": "thrE2"}, {"id": "gmailTSTOP01", "thread": "thrF"}, {"id": "bad id!", "thread": "x"}]', 'tokenS1');
  assert r = '{"done": 1, "added": 10}', 'ten valid ids staged, the left-alone one done: ' || r::text;
  r := public.wa289_stage_ids(v_run, 'steel', '[{"id": "gmailTIN0001", "thread": "thrA"}]', 'tokenS2');
  assert r = '{"done": 0, "added": 0}' and (select page_token from public.crm_mail_scans where run_id = v_run and mailbox = 'steel') = 'tokenS2', 'ids are idempotent and the token is saved';
  r := public.wa289_stage_ids(v_run, 'hub', '[{"id": "gmailTDONE01", "thread": "h0"}, {"id": "gmailTSEEN01", "thread": "h1"}, {"id": "gmailTHDUP01", "thread": "hA"}, {"id": "gmailTHIN001", "thread": "hB"}]', null);
  assert r = '{"done": 2, "added": 4}', 'the imported and seen ids are done: ' || r::text;
  assert (select string_agg(reason, ',' order by gmail_id) from import_stage.mail_messages where run_id = v_run and state = 'done') = 'imported,left_alone,seen', 'with their reasons';
  assert public.wa289_todo(v_run, 'steel', 'headers', 3) = '["gmailSKIP0001", "gmailTBAD002", "gmailTBIG001"]', 'headers todo lists listed ids';

  assert pg_temp.err(format($q$select public.wa289_save_headers(%s, 'steel', '[{"id": "gmailTIN0001", "state": "kept", "body": "x"}]')$q$, v_run)) like '%may not carry body%', 'a body-like key is refused';
  r := public.wa289_save_headers(v_run, 'steel', jsonb_build_array(
    jsonb_build_object('id', 'gmailSKIP0001', 'state', 'kept', 'direction', 'in', 'writer', 'private@example.org', 'subject', 'Kept?', 'msg_md5', md5('<s1@example.invalid>')),
    jsonb_build_object('id', 'gmailTIN0001', 'thread', 'thrA', 'state', 'kept', 'direction', 'in', 'box', 'steel', 'writer', 'Existing.Writer@org.example.org', 'writer_name', 'Test Existing',
                       'outside', jsonb_build_array('existing.writer@org.example.org'), 'subject', 'Food drive', 'msg_md5', md5('<a1@example.invalid>'), 'sent_at', '2021-03-12T10:00:00Z'),
    jsonb_build_object('id', 'gmailTOUT001', 'thread', 'thrA', 'state', 'kept', 'direction', 'out', 'box', 'steel', 'outside', jsonb_build_array('existing.writer@org.example.org', 'quiet.cc@example.org'),
                       'recipients', jsonb_build_array('existing.writer@org.example.org', 'quiet.cc@example.org'), 'subject', 'Food drive', 'msg_md5', md5('<a2@example.invalid>'), 'sent_at', '2021-03-13T10:00:00Z'),
    jsonb_build_object('id', 'gmailTIN0002', 'thread', 'thrB', 'state', 'kept', 'direction', 'in', 'box', 'info', 'writer', 'new.writer@neworg.example.org', 'writer_name', 'Test New',
                       'outside', jsonb_build_array('new.writer@neworg.example.org'), 'subject', 'Volunteering', 'msg_md5', md5('<b1@example.invalid>'), 'sent_at', '2023-05-01T10:00:00Z'),
    jsonb_build_object('id', 'gmailTBIG001', 'thread', 'thrC', 'state', 'kept', 'direction', 'out', 'box', 'steel', 'outside', jsonb_build_array('a@example.org', 'b@example.org', 'c@example.org', 'd@example.org', 'e@example.org', 'f@example.org'),
                       'recipients', '[]'::jsonb, 'subject', 'Newsletter', 'msg_md5', md5('<c1@example.invalid>'), 'sent_at', '2022-01-01T10:00:00Z'),
    jsonb_build_object('id', 'gmailTINT001', 'thread', 'thrD', 'state', 'kept', 'direction', 'in', 'box', 'steel', 'writer', 'w289.staff.home@example.invalid',
                       'outside', jsonb_build_array('w289.staff.home@example.invalid'), 'subject', 'Staff note', 'msg_md5', md5('<d1@example.invalid>'), 'sent_at', '2022-02-01T10:00:00Z'),
    jsonb_build_object('id', 'gmailTDLV001', 'thread', 'thrE', 'state', 'skipped', 'reason', 'bounce', 'sent_at', '2024-01-01T10:00:00Z'),
    jsonb_build_object('id', 'gmailTBAD002', 'thread', 'thrE2', 'state', 'skipped', 'reason', 'bounce', 'sent_at', '2024-01-02T10:00:00Z'),
    jsonb_build_object('id', 'gmailTSTOP01', 'thread', 'thrF', 'state', 'kept', 'direction', 'in', 'box', 'steel', 'writer', 'stop.writer@example.org', 'writer_name', 'Test Stop',
                       'outside', jsonb_build_array('stop.writer@example.org'), 'subject', 'Private matter', 'msg_md5', md5('<f1@example.invalid>'), 'sent_at', '2025-06-01T10:00:00Z')));
  assert r = '{"saved": 9}', 'nine headers saved: ' || r::text;
  assert (select state || ':' || reason from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailSKIP0001') = 'left_alone:personal'
     and (select writer is null and subject is null and msg_md5 is null from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailSKIP0001')
     and exists (select 1 from import_stage.mail_left_alone where mailbox = 'steel' and gmail_id = 'gmailSKIP0001'), 'rule a on the database side: mybox skipped it, so the id alone is kept';
  assert (select writer from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTIN0001') = 'existing.writer@org.example.org', 'the writer key is lower case and trimmed';
  assert (select recipients is null from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTIN0001'), 'incoming mail has no recipients';
  assert (select oldest_at from public.crm_mail_scans where run_id = v_run and mailbox = 'steel') = '2021-03-12T10:00:00Z', 'the oldest date';
  r := public.wa289_save_headers(v_run, 'hub', jsonb_build_array(
    jsonb_build_object('id', 'gmailTHDUP01', 'thread', 'hA', 'state', 'kept', 'direction', 'in', 'box', 'hub', 'writer', 'existing.writer@org.example.org',
                       'outside', jsonb_build_array('existing.writer@org.example.org'), 'subject', 'Food drive', 'msg_md5', md5('<a1@example.invalid>'), 'sent_at', '2021-03-12T10:00:00Z'),
    jsonb_build_object('id', 'gmailTHIN001', 'thread', 'hB', 'state', 'kept', 'direction', 'in', 'box', 'hub', 'writer', 'phone.writer@example.org', 'writer_name', 'Test Phone',
                       'outside', jsonb_build_array('phone.writer@example.org'), 'subject', 'Event', 'msg_md5', md5('<h1@example.invalid>'), 'sent_at', '2024-09-01T10:00:00Z')));
  assert r = '{"saved": 2}', 'hub headers saved';
  assert pg_temp.err(format('select public.wa289_dedupe(%s)', v_run)) like '%dedupe waits until every mailbox%', 'dedupe waits for both mailboxes';
end $$;

-- ---------------------------------------------------------------- dedupe, bounces
do $$
declare v_run bigint := pg_temp.id('run'); r jsonb;
begin
  perform public.wa289_scan_set(v_run, null, '{"phase": "dedupe"}');
  assert pg_temp.err(format($q$select public.wa289_scan_set(%s, null, '{"spend_usd": 0}')$q$, v_run)) like '%does not take spend_usd%', 'scan_set takes only its keys';
  r := public.wa289_dedupe(v_run);
  assert r = '{"seen": 0, "internal": 1, "duplicate": 1}', 'one internal, one duplicate: ' || r::text;
  assert (select mailbox || ':' || state from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTHDUP01') = 'hub:skipped'
     and (select state from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTIN0001') = 'kept', 'Steel''s copy is kept, hub@''s is the duplicate';
  assert (select reason from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTINT001') = 'internal', 'mail from a staff alias is internal';
  assert (select count(*) from import_stage.mail_seen where run_id = v_run) = 6, 'every kept hash recorded: ' || (select count(*) from import_stage.mail_seen where run_id = v_run);
  assert (select count(*) from public.crm_mail_scans where run_id = v_run and phase = 'bounces') = 2, 'both scans move to bounces';
  assert public.wa289_todo(v_run, 'steel', 'bounces', 10) = '["gmailTBAD002", "gmailTDLV001"]', 'the delivery reports to parse';
  perform public.wa289_save_bounce(v_run, 'steel', 'gmailTDLV001', 'Gone.Person@example.org', '5.1.1');
  perform public.wa289_save_bounce(v_run, 'steel', 'gmailTBAD002', 'soft@example.org', '4.2.2');
  assert (select bounce_addr || ' ' || bounce_code from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTDLV001') = 'gone.person@example.org 5.1.1', 'a permanent failure is staged';
  assert (select bounce_addr is null and bounce_read_at is not null from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTBAD002'), 'a soft failure is read, nothing staged';
  assert public.wa289_todo(v_run, 'steel', 'bounces', 10) = '[]', 'no report left';
  -- a later run would mark the kept ids seen (mail_seen by mailbox and id)
  assert exists (select 1 from import_stage.mail_seen where mailbox = 'steel' and gmail_id = 'gmailTIN0001'), 'the kept copy is remembered across runs';
end $$;

-- ---------------------------------------------------------------- the sample, spend before go, threads
do $$
declare v_run bigint := pg_temp.id('run'); r jsonb;
begin
  perform public.wa289_scan_set(v_run, null, '{"phase": "sample"}');
  assert jsonb_array_length(public.wa289_todo(v_run, 'steel', 'sample', 50)) = 4, 'four kept, unread threads in Steel''s mailbox (thrA, thrB, thrC, thrF)';
  assert public.wa289_thread_rows(v_run, 'steel', 'thrA') = '[{"id": "gmailTIN0001", "writer": "existing.writer@org.example.org", "direction": "in"}, {"id": "gmailTOUT001", "writer": null, "direction": "out"}]',
    'only the kept, unread emails go to the reader: ' || public.wa289_thread_rows(v_run, 'steel', 'thrA')::text;
  assert pg_temp.err(format($q$select public.wa289_save_thread(%s, 'steel', 'thrA', '{"leave_out": "none", "topic": "event", "emails": [{"id": "gmailTIN0001", "html": "<p>"}]}', 0)$q$, v_run)) like '%may not carry body%', 'body-like keys refused';
  assert pg_temp.err(format($q$select public.wa289_save_thread(%s, 'steel', 'thrA', '{"leave_out": "none", "topic": "gossip", "emails": []}', 0)$q$, v_run)) like '%unknown value%', 'enums checked again';
  r := public.wa289_save_thread(v_run, 'steel', 'thrA', '{"leave_out": "none", "topic": "partnership", "lang": "en", "emails": [
        {"id": "gmailTIN0001", "line": "Asks to partner on a food drive", "asks_to_stop": false, "sig": {"name": "Test Existing Writer", "organization": "Test Partner Org", "website": "https://www.org.example.org", "fax": "x"}},
        {"id": "gmailTOUT001", "line": "WA offers two dates", "asks_to_stop": true, "sig": {"name": "Staff"}}]}', 0.1);
  assert (r ->> 'sample_over')::boolean = false and (r ->> 'spend')::numeric = 0.1, 'the spend is added; the sample cap not reached: ' || r::text;
  assert (select line || '|' || topic || '|' || (sig ->> 'organization') || '|' || (sig ? 'fax')::text from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTIN0001')
       = 'Asks to partner on a food drive|partnership|Test Partner Org|false', 'the line, topic and allowed signature fields are staged';
  assert (select not asks_to_stop and sig is null from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTOUT001'), 'asks-to-stop and signatures only from outside';
  r := public.wa289_save_thread(v_run, 'steel', 'thrF', '{"leave_out": "personal", "topic": "other", "lang": "en", "emails": [{"id": "gmailTSTOP01", "line": "", "asks_to_stop": true, "sig": null}]}', 0.2);
  assert (r ->> 'sample_over')::boolean, 'past the sample cap before go: ' || r::text;
  assert (select state || ':' || reason || ':' || asks_to_stop::text || ':' || writer || ':' || coalesce(subject, 'null') from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTSTOP01')
       = 'left_alone:personal:true:stop.writer@example.org:null', 'a left-out thread keeps only asks-to-stop (with the key that lets it act)';
  assert exists (select 1 from import_stage.mail_left_alone where mailbox = 'steel' and gmail_id = 'gmailTSTOP01' and why = 'personal'), 'and its id is left alone for later runs';
  perform public.wa289_save_thread(v_run, 'steel', 'thrB', null, 0.01);
  perform public.wa289_save_thread(v_run, 'steel', 'thrB', null, 0.01);
  perform public.wa289_save_thread(v_run, 'steel', 'thrC', '{"leave_out": "none", "topic": "other", "lang": "en", "emails": [{"id": "gmailTBIG001", "line": "A newsletter to supporters", "asks_to_stop": false}]}', 0);
  assert (select read_fail from import_stage.mail_messages where run_id = v_run and gmail_id = 'gmailTIN0002') = 2 and public.wa289_todo(v_run, 'steel', 'threads', 50) = '[]', 'a rejected answer stages nothing; after two the thread is not read again';
  assert (public.wa289_sizes(v_run) ->> 'threads_read')::int = 3, 'sizes count the read threads (thrA, thrC, thrF)';
  assert pg_temp.err(format('select public.wa289_go(%s, %L)', v_run, 'x')) like '%needs every scan%waiting%', 'go needs both scans waiting';
  perform public.wa289_scan_set(v_run, 'steel', '{"phase": "waiting", "estimate_usd": 3.2}');
  perform public.wa289_scan_set(v_run, 'hub', '{"phase": "waiting", "estimate_usd": 0.8}');
  -- eh-289 I5: go refuses while a route is not ready
  update public.ai_routes set provider = null where task = 'mail_history_org';
  assert pg_temp.err(format('select public.wa289_go(%s, %L)', v_run, 'x')) like 'wa284: email history: not ready (route mail_history_org has no no-retention provider setting)%', 'go checks the routes';
  update public.ai_routes set provider = '{"data_collection": "deny", "zdr": true}' where task = 'mail_history_org';
  r := public.wa289_go(v_run, 'w281.admin@example.invalid');
  assert r = '{"cap": 6.00, "estimate": 4.00}', 'go sets 1.5 times the estimate: ' || r::text;
  assert (select count(*) from public.crm_mail_scans where run_id = v_run and phase = 'threads' and cap_usd = 6 and go_at is not null) = 2, 'both scans go to threads with the cap';
  assert exists (select 1 from public.change_log where entity_type = 'crm_mail_scans' and field = 'go' and new_value not like '%@%'), 'go is logged without an address';
  r := public.wa289_set_cap(v_run, 500, 'w281.admin@example.invalid');
  assert (r ->> 'cap')::numeric = 60, 'the cap never goes above mail_history_cap_usd';
  perform public.wa289_set_cap(v_run, 6, 'w281.admin@example.invalid');
  r := public.wa289_spend(v_run, 'hub', 6);
  assert (r ->> 'paused')::boolean and (select bool_and(paused) from public.crm_mail_scans where run_id = v_run), 'the run pauses at the cap';
  assert pg_temp.err(format('select public.wa289_pause(%s, false, %L)', v_run, 'x')) like '%raise the cap first%', 'resume is refused at the cap';
  perform public.wa289_set_cap(v_run, 20, 'x');
  perform public.wa289_pause(v_run, false, 'x');
  assert not (select bool_or(paused) from public.crm_mail_scans where run_id = v_run), 'resumed after the cap was raised';
end $$;

-- ---------------------------------------------------------------- people, Look at them, organisations
do $$
declare v_run bigint := pg_temp.id('run'); r jsonb;
begin
  -- the hub thread is read with a signature phone that matches an existing contact; another hub writer is suppressed as deleted
  perform public.wa289_save_thread(v_run, 'hub', 'hB', '{"leave_out": "none", "topic": "event", "lang": "fr", "emails": [{"id": "gmailTHIN001", "line": "Asks about the gala", "asks_to_stop": false, "sig": {"phone": "15145550177"}}]}', 0.01);
  perform public.wa289_stage_ids(v_run, 'hub', '[{"id": "gmailTHDEL01", "thread": "hD"}]', null);
  perform public.wa289_save_headers(v_run, 'hub', '[{"id": "gmailTHDEL01", "thread": "hD", "state": "kept", "direction": "in", "box": "hub", "writer": "deleted.person@example.org", "outside": ["deleted.person@example.org"], "subject": "x", "sent_at": "2022-01-01T00:00:00Z"}]');
  insert into public.crm_email_suppressions (addr_md5, kind, source) values (md5('deleted.person@example.org'), 'deleted', 'test');
  assert pg_temp.err(format('select public.wa289_group(%s)', v_run)) like '%grouping waits%', 'grouping waits for both mailboxes to reach people';
  perform public.wa289_scan_set(v_run, null, '{"phase": "people"}');
  r := public.wa289_group(v_run);
  assert r = '{"optouts": 2, "writers": 3, "suppressed": 1, "outbound_only": 1}', 'writers, opt-outs, the outbound-only recipient and the deleted address: ' || r::text;
  assert not exists (select 1 from import_stage.mail_people where run_id = v_run and key in ('quiet.cc@example.org', 'deleted.person@example.org', 'a@example.org')), 'outbound-only, suppressed and mailing recipients are never grouped';
  assert (select writer::text || ':' || optout || ':' || optout_at::text from import_stage.mail_people where run_id = v_run and key = 'stop.writer@example.org') = 'false:asked_to_stop:2025-06-01',
    'a writer whose every thread was left out is an opt-out row only';
  assert (select writer::text || ':' || optout from import_stage.mail_people where run_id = v_run and key = 'gone.person@example.org') = 'false:bounced', 'a bounced address is an opt-out row';
  assert (select match_kind || ':' || match_id || ':' || name || ':' || (counts ->> 'in') || ':' || (counts ->> 'out') || ':' || array_to_string(mailboxes, ',') || ':' || (sig ->> 'organization')
            from import_stage.mail_people where run_id = v_run and key = 'existing.writer@org.example.org') = 'email:4001:Test Existing:1:1:steel:Test Partner Org',
    'the existing writer: matched, counts in and out, the mailbox, the single signature value: '
    || (select match_kind || ':' || match_id || ':' || name || ':' || (counts ->> 'in') || ':' || (counts ->> 'out') || ':' || array_to_string(mailboxes, ',') from import_stage.mail_people where run_id = v_run and key = 'existing.writer@org.example.org');
  assert (select match_kind || ':' || match_id || ':' || lang from import_stage.mail_people where run_id = v_run and key = 'phone.writer@example.org') = 'phone_only:4004:fr', 'a signature phone is listed phone_only';
  assert (select match_kind from import_stage.mail_people where run_id = v_run and key = 'new.writer@neworg.example.org') = 'none', 'a new writer';
  assert (select counts -> 'by_year' from import_stage.mail_people where run_id = v_run and key = 'existing.writer@org.example.org') = '{"2021": 2}', 'counts by year';
  assert jsonb_array_length(public.wa289_todo(v_run, null, 'people', 50)) = 3, 'three writers to type';
  assert not (public.wa289_todo(v_run, null, 'people', 50)::text ~ '"(body|snippet|text)"'), 'the type never sees a body';
  perform public.wa289_save_person(v_run, 'existing.writer@org.example.org', 'partner', 0.86, 0.0002);
  assert pg_temp.err(format($q$select public.wa289_save_person(%s, 'x', 'friend', 0.5, 0)$q$, v_run)) like '%unknown type%', 'types are checked';
  -- a re-run keeps the type and an admin's choices
  update import_stage.mail_people set excluded = true where run_id = v_run and key = 'new.writer@neworg.example.org';
  perform public.wa289_group(v_run);
  assert (select rel_type || ':' || rel_conf from import_stage.mail_people where run_id = v_run and key = 'existing.writer@org.example.org') = 'partner:0.860'
     and (select excluded from import_stage.mail_people where run_id = v_run and key = 'new.writer@neworg.example.org'), 'grouping again keeps the type and Leave out';
  update import_stage.mail_people set excluded = false where run_id = v_run and key = 'new.writer@neworg.example.org';

  -- Look at them: people from Steel's mailbox reach only Steel
  r := public.wa289_people(v_run, '{}', 0, 'w281.admin@example.invalid');
  assert (r ->> 'hidden')::int = 4 and (r ->> 'total')::int = 1 and r -> 'rows' -> 0 ->> 'key' = 'phone.writer@example.org', 'another admin sees hub@ people only: ' || r::text;
  r := public.wa289_people(v_run, '{}', 0, 'steel.macdonald@welfareavenue.com');
  assert (r ->> 'hidden')::int = 0 and (r ->> 'total')::int = 5, 'Steel sees everyone';
  assert (public.wa289_people(v_run, '{}', 0, 'Test.Owner.Alias@example.invalid') ->> 'total')::int = 5, 'Steel''s alias is Steel';
  assert (public.wa289_people(v_run, '{"asked_to_stop": true}', 0, 'steel.macdonald@welfareavenue.com') ->> 'total')::int = 1, 'the asked-to-stop filter';
  assert (public.wa289_people(v_run, '{"match": "existing"}', 0, 'steel.macdonald@welfareavenue.com') ->> 'total')::int = 1, 'the existing filter';
  assert (public.wa289_people(v_run, '{"phone_only": true}', 0, 'w281.admin@example.invalid') ->> 'total')::int = 1, 'the phone-only filter';
  assert pg_temp.err(format($q$select public.wa289_people(%s, '{"mailbox": "steel"}', 0, 'w281.admin@example.invalid')$q$, v_run)) like '%only Steel%', 'asking for Steel''s mailbox is refused';
  assert pg_temp.err(format($q$select public.wa289_exclude(%s, 'existing.writer@org.example.org', 'person', true, 'w281.admin@example.invalid')$q$, v_run)) like '%only Steel%', 'only Steel leaves out his people';
  perform public.wa289_exclude(v_run, 'stop.writer@example.org', 'optout', true, 'steel.macdonald@welfareavenue.com');
  perform public.wa289_exclude(v_run, 'phone.writer@example.org', 'person', true, 'w281.admin@example.invalid');
  assert (select not_optout from import_stage.mail_people where run_id = v_run and key = 'stop.writer@example.org')
     and (select excluded from import_stage.mail_people where run_id = v_run and key = 'phone.writer@example.org'), 'Not an opt-out and Leave out';
  assert pg_temp.err(format($q$select public.wa289_exclude(%s, 'new.writer@neworg.example.org', 'optout', true, 'steel.macdonald@welfareavenue.com')$q$, v_run)) like '%no staged opt-out%', 'Not an opt-out needs one';
  assert not exists (select 1 from public.change_log where entity_type = 'crm_mail_scans' and new_value like '%@%'), 'the log never holds an address';

  -- organisations
  r := public.wa289_orgs_todo(v_run, 20);
  assert r = jsonb_build_array(jsonb_build_object('domain', 'org.example.org', 'partner_id', (select id from public.wa_partners where name = 'Test Partner Org'), 'over_cap', false)),
    'the typed partner''s domain, matched by the website''s host: ' || r::text;
  assert pg_temp.err(format($q$select public.wa289_save_org(%s, 'org.example.org', '{"outcome": "found", "facts": {"name": "x", "people": ["y"]}}', 0)$q$, v_run)) like '%facts may not carry people%', 'nothing about people';
  assert pg_temp.err(format($q$select public.wa289_save_org(%s, 'org.example.org', '{"outcome": "found", "page_text": "x"}', 0)$q$, v_run)) like '%may not carry body%', 'no page text';
  perform public.wa289_save_org(v_run, 'org.example.org', '{"robots": "allowed", "url": "https://org.example.org/", "facts": {"name": "Test Partner Org", "kind": "charity", "city": "Montreal"}, "conf": 0.9, "outcome": "found"}', 0.002);
  assert public.wa289_orgs_todo(v_run, 20) = '[]', 'a domain is looked up once';
end $$;

-- ---------------------------------------------------------------- status, pump, lease
do $$
declare v_run bigint := pg_temp.id('run'); r jsonb;
begin
  r := public.wa289_status(v_run);
  assert r::text not like '%@%', 'status holds no address';
  assert (r -> 'mailboxes' -> 0 ->> 'mailbox') = 'steel' and (r -> 'mailboxes' -> 0 -> 'counts' -> 'by_reason' ->> 'personal')::int = 2, 'counts by reason: ' || (r -> 'mailboxes' -> 0 -> 'counts')::text;
  assert (r -> 'people' ->> 'writers')::int = 3 and (r -> 'orgs' ->> 'found')::int = 1 and r -> 'ready' = '[]', 'people, organisations, ready';
  assert (select counts -> 'run' ->> 'outbound_only' from public.crm_mail_scans where run_id = v_run and mailbox = 'hub') = '1', 'the run counts stay on the scans';
  assert public.wa289_pump(true) = 'on', 'pump on';
  assert (select count(*) from cron.job where jobname = 'wa-mail-history-pump' and command like '%call_edge(''mail-history''%pump%') = 1, 'the pump is scheduled';
  perform public.wa289_pump(true);
  assert (select count(*) from cron.job where jobname = 'wa-mail-history-pump') = 1, 'once';
  assert public.wa289_pump(false) = 'off', 'pump off';
  assert not exists (select 1 from cron.job where jobname = 'wa-mail-history-pump'), 'and removed';
  perform public.wa289_scan_set(v_run, null, '{"phase": "threads", "release": true}');
  assert public.wa289_active() = jsonb_build_array(v_run), 'an active run with a free lease';
  assert public.wa289_lease(v_run), 'the lease is taken';
  assert not public.wa289_lease(v_run), 'only once';
  assert position('pg_try_advisory_xact_lock' in pg_get_functiondef('public.wa289_lease(bigint)'::regprocedure)) > 0
     and position('not exists' in pg_get_functiondef('public.wa289_lease(bigint)'::regprocedure)) > 0, 'eh-289 I3: the lease is one locked, conditional update';
  assert public.wa289_active() = '[]', 'a held lease is not pumped';
  update public.crm_mail_scans set step_at = now() - interval '200 seconds' where run_id = v_run;
  assert public.wa289_active() = jsonb_build_array(v_run) and public.wa289_lease(v_run), 'an expired lease is restarted';
  perform public.wa289_scan_set(v_run, null, '{"release": true, "last_error": "headers: 429"}');
  assert (select bool_and(step_at is null and last_error = 'headers: 429') from public.crm_mail_scans where run_id = v_run), 'release frees the lease and keeps the error code';
  perform public.wa289_pause(v_run, true, 'x');
  assert public.wa289_active() = '[]', 'a paused run is not pumped';
end $$;

select 'w289sql: all assertions passed' as result;
rollback;

-- Welfare Avenue Hub: wave292. Assertions for build/data/wa292_batches.sql (the email history batches and the summary pass's database).
-- Assumes slice 1's files, wave289 (test/w289schema.sql, build/data/wa289_scan.sql), test/w292schema.sql and the migration are loaded. Everything
-- runs in one transaction and ends with a rollback; any failed assertion raises. Offline: node test/w292sql.mjs (PGlite).
-- Every person, address, subject and id is invented (Test ..., example.org, example.invalid, gmail ids gm292...).

begin;
create temp table w292ids (k text primary key, v bigint);
create function pg_temp.id(p text) returns bigint language sql as $$ select v from w292ids where k = p $$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return ''; exception when others then return sqlerrm; end $$;
create function pg_temp.batch(p_kind text) returns bigint language sql as $$ select public.wa284_new_batch(9201, p_kind) $$;
create function pg_temp.cmp(p_kind text) returns jsonb language sql as $$ select public.wa284_compare(pg_temp.batch(p_kind), 'test') $$;
create function pg_temp.app(p_kind text) returns jsonb language plpgsql as $$
declare r jsonb; b bigint := pg_temp.batch(p_kind);
begin
  if (select status from public.crm_import_batches where id = b) is distinct from 'compared' then
    r := public.wa284_compare(b, 'test');
    if r ? 'error' then raise exception 'compare % stopped: %', p_kind, r ->> 'error'; end if;
  end if;
  return public.wa284_apply(b, 'test');
end $$;
create function pg_temp.contact(p_email text) returns bigint language sql as $$ select c.id from public.crm_contacts c where p_email = any(c.emails) and c.merged_into is null order by c.id limit 1 $$;

-- ---------------------------------------------------------------- the structure
do $$
declare f record;
begin
  assert (select relrowsecurity from pg_class where oid = 'public.crm_email_relationship'::regclass), 'crm_email_relationship has row level security';
  assert has_table_privilege('authenticated', 'public.crm_email_relationship', 'select') and not has_table_privilege('authenticated', 'public.crm_email_relationship', 'insert')
     and not has_table_privilege('authenticated', 'public.crm_email_relationship', 'update') and not has_table_privilege('anon', 'public.crm_email_relationship', 'select'), 'signed-in users only read the relationship rows';
  assert not exists (select 1 from pg_attribute a where a.attrelid = 'public.crm_email_relationship'::regclass and a.attnum > 0 and not a.attisdropped and col_description(a.attrelid, a.attnum) is null), 'every column has a comment';
  assert (select reloptions::text from pg_class where oid = 'public.crm_email_relationship_v'::regclass) like '%security_invoker=true%', 'the view is security_invoker';
  assert (select count(*) from pg_policy where polrelid = 'public.crm_interactions'::regclass and not polpermissive and polname like 'crm_interactions_wa292_%') = 2, 'two restrictive policies on crm_interactions';
  assert exists (select 1 from pg_trigger where tgname = 'trg_wa292_suppress') and exists (select 1 from pg_trigger where tgname = 'trg_wa292_suppress_del'), 'the suppression triggers';
  assert not exists (select 1 from pg_trigger where tgname = 'trg_wa292_gmail_cleanup'), 'the cascade holds, so no cleanup trigger';
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'wa292\_%' or p.proname like 'crm_insight\_%') loop
    assert not has_function_privilege('authenticated', f.sig, 'execute') and not has_function_privilege('anon', f.sig, 'execute'), f.sig || ': not for signed-in users';
    assert obj_description(f.sig, 'pg_proc') is not null, f.sig || ' has a comment';
  end loop;
  assert has_function_privilege('authenticated', 'public.crm_mail_steel_open()', 'execute'), 'the policies'' helper is callable by signed-in users';
  assert position('wa292_write' in pg_get_functiondef('public.wa284_write(bigint,boolean)'::regprocedure)) > 0, 'wa284_write dispatches the mail kinds';
  assert position('not for bulk email' in pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure)) > 0, 'crm_email_permission has the clause';
  assert position('crm_email_relationship' in pg_get_functiondef('public.crm_merge_contacts(bigint,bigint)'::regprocedure)) > 0, 'crm_merge_contacts moves the row';
  assert (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave292' and field = 'wave292') = 1, 'one release line';
end $$;

-- ---------------------------------------------------------------- batches only on the right run, and only in order
do $$
declare r jsonb;
begin
  assert pg_temp.err('select public.wa284_new_batch(9200, ''mail_people'')') like 'wa284: unknown batch kind%', 'no mail batch on a Keela run';
  assert pg_temp.err('select public.wa284_new_batch(9201, ''people'')') like 'wa284: unknown batch kind%', 'no Keela batch on an email-history run';
  r := pg_temp.cmp('mail_people');
  assert r ->> 'error' like 'wa284: email history: apply mail_optouts, mail_orgs first%', 'Compare needs the cards above applied: ' || coalesce(r ->> 'error', r::text);
end $$;

-- ---------------------------------------------------------------- 1. mail_optouts
do $$
declare r jsonb;
begin
  r := pg_temp.cmp('mail_optouts');
  assert r ->> 'error' is null and (r #>> '{lists,mail,contacts_changed}')::int = 2, 'compare: two contacts change: ' || r::text;
  assert (select email_status from public.crm_contacts where id = 9301) = 'unknown' and not exists (select 1 from public.crm_email_suppressions where kind <> 'deleted'), 'the compare rolled back';
  r := pg_temp.app('mail_optouts');
  assert (select email_status || '|' || consent_source from public.crm_contacts where id = 9301) = 'unsubscribed|Email history: asked to stop 2022-05-01', 'asked to stop unsubscribes';
  assert (select email_status from public.crm_contacts where id = 9302) = 'bounced', 'a bounce on the sending address sets bounced';
  assert (select email_status from public.crm_contacts where id = 9303) = 'unknown' and r -> 'lists' -> 'bounce_not_sending_address' @> '[{"contact_id": 9303}]', 'a bounce on another address is listed, not applied';
  assert (select count(*) from public.crm_email_suppressions where kind in ('asked_to_stop', 'bounced')) = 2, 'both go into the suppression list';
  assert (select source from public.crm_consent_events where contact_id = 9301 and column_name = 'email_status' order by id desc limit 1) = 'Email history', 'the consent log says Email history';
  assert r::text !~ '@', 'the report holds no address';
  assert pg_temp.err('select public.wa284_undo(' || pg_temp.batch('mail_optouts') || ', ''test'')') like '%never undone%', 'mail_optouts is never undone';
end $$;

-- ---------------------------------------------------------------- the suppression trigger
do $$
declare v bigint;
begin
  insert into public.crm_contacts (full_name, emails) values ('Test Form Person', array['Stop.Writer@example.org ']) returning id into v;
  assert (select email_status || '|' || consent_source from public.crm_contacts where id = v) = 'unsubscribed|suppression list', 'a suppressed address is born opted out';
  update public.crm_contacts set emails = emails || 'gone.person@example.org'::text where id = 4004;
  assert (select email_status from public.crm_contacts where id = 4004) = 'bounced', 'adding a bounced address sets bounced';
  update public.crm_contacts set email_status = 'unknown' where id = 4004;
  update public.crm_contacts set full_name = 'Test Phone Person' where id = 4004;
  assert (select email_status from public.crm_contacts where id = 4004) = 'unknown', 'an update that adds no address changes nothing';
  update public.crm_contacts set emails = array['other@example.org'] where id = 4004;
  delete from public.crm_contacts where id = v;
  assert not exists (select 1 from public.crm_email_suppressions where kind = 'deleted' and addr_md5 = md5('stop.writer@example.org')), 'a contact without email history adds no deleted suppression';
end $$;

-- ---------------------------------------------------------------- 2. mail_orgs
do $$
declare r jsonb;
begin
  r := pg_temp.app('mail_orgs');
  assert (select count(*) from public.wa_partners where name = 'Test New Org' and domain = 'neworg.example.org' and relationship = 'partner' and category = 'partner' and status = 'active'
          and address = 'Montreal, QC' and summary = 'Runs a test pantry.' and sources @> '[{"source": "email history", "run": 9201}]') = 1, 'a new organisation from its homepage';
  assert (select domain || '|' || summary from public.wa_partners where name = 'Test Partner Org') = 'org.example.org|A test partner organisation.', 'a match gets its blanks filled';
  assert (r #>> '{counts,skipped,robots.txt refused}')::int = 1 and r -> 'lists' -> 'names_created' = '["Test New Org"]', 'skips by outcome, lists names: ' || r::text;
end $$;

-- ---------------------------------------------------------------- 3. mail_people
do $$
declare r jsonb; v bigint; g bigint;
begin
  r := pg_temp.app('mail_people');
  v := pg_temp.contact('new.writer@neworg.example.org');
  insert into w292ids values ('new', v);
  assert (select full_name || '|' || first_name || '|' || last_name || '|' || array_to_string(phones, ',') || '|' || job_title || '|' || organization || '|' || language || '|' || array_to_string(kinds, ',')
                 || '|' || array_to_string(tags, ',') || '|' || source || '|' || email_status from public.crm_contacts where id = v)
       = 'Test New Writer|Test|New Writer|5145550199|Test Director|Test New Org|en|partner|email history|email_history|unknown', 'a new contact from the writer';
  assert (select legacy_refs #>> '{email_history,run}' from public.crm_contacts where id = v) = '9201', 'legacy_refs.email_history';
  assert exists (select 1 from public.crm_contact_orgs o join public.wa_partners w on w.id = o.partner_id where o.contact_id = v and w.name = 'Test New Org'), 'linked to its organisation';
  assert exists (select 1 from public.crm_contact_fields cf join public.crm_fields f on f.id = cf.field_id where cf.contact_id = v and f.key = 'linkedin'), 'the LinkedIn field';
  assert (select rel_type || '|' || rel_conf || '|' || from_steel from public.crm_email_relationship where contact_id = v) = 'partner|0.90|true', 'the type row, from Steel''s mailbox';
  g := pg_temp.contact('info@generalorg.example.org');
  insert into w292ids values ('general', g);
  assert (select full_name || '|' || array_to_string(tags, ',') from public.crm_contacts where id = g) = 'generalorg.example.org (general inbox)|email history,general inbox', 'a general inbox';
  assert (select basis from public.crm_email_permission(g, 'newsletter')) = 'not for bulk email', 'a general inbox gets no newsletter';
  assert (select allowed from public.crm_email_permission(g, 'transactional')), 'but a transactional email still goes';
  assert pg_temp.contact('left.out@example.org') is null and pg_temp.contact('suppressed.deleted@example.org') is null and pg_temp.contact('phone.person@example.org') is null, 'left out, deleted before and phone-only make no contact';
  assert r -> 'lists' -> 'phone_only' = '[{"contact_id": 4004}]' and (r #>> '{counts,skipped,internal}')::int = 1 and (r #>> '{counts,matched}')::int = 2, 'phone-only listed, internal skipped, two matched: ' || r::text;
  assert (r #>> '{counts,created}')::int = 2 and (r #>> '{lists,mail,by_type,partner}')::int = 1 and (r #>> '{lists,mail,outbound_only}')::int = 1, 'counts by type: ' || r::text;
  assert r::text !~ '@', 'the report holds no address';
end $$;

-- ---------------------------------------------------------------- 4. mail_enrich
do $$
declare r jsonb;
begin
  r := pg_temp.app('mail_enrich');
  assert (select job_title || '|' || language || '|' || array_to_string(tags, ',') || '|' || array_to_string(kinds, ',') from public.crm_contacts where id = 4001) = 'Test Coordinator|fr|email history|supporter', 'blanks filled, the tag, kinds when empty';
  assert (select rel_type from public.crm_email_relationship where contact_id = 4001) = 'supporter', 'a type row';
  assert exists (select 1 from public.crm_contact_orgs o join public.wa_partners w on w.id = o.partner_id where o.contact_id = 4001 and w.name = 'Test Partner Org'), 'linked by domain';
  assert (select email_status from public.crm_contacts where id = 9301) = 'unsubscribed', 'never an opt-out column';
  assert (r #>> '{counts,skipped,created by this run}')::int = 2, 'the contacts batch 3 made are not enriched: ' || r::text;
end $$;

-- ---------------------------------------------------------------- 5. mail_interactions, the basis, the policies, first contacts
do $$
declare r jsonb; b bigint := pg_temp.batch('mail_interactions');
begin
  r := pg_temp.cmp('mail_interactions');
  update import_stage.mail_people set excluded = true where key = 'existing.writer@org.example.org';
  assert pg_temp.err('select public.wa284_apply(' || b || ', ''test'')') like '%changed since the compare%', 'Apply refuses when the exclusions changed since the compare';
  update import_stage.mail_people set excluded = false where key = 'existing.writer@org.example.org';
  r := pg_temp.cmp('mail_interactions');
  r := pg_temp.app('mail_interactions');
  assert (select count(*) from public.crm_interactions where source = 'gmail') = 5, 'one line per kept email per person (new writer 2, existing writer 1, general inbox 1, stop writer 1)';
end $$;
do $$
declare v bigint := pg_temp.id('new'); r jsonb := (select report from public.crm_import_batches where run_id = 9201 and kind = 'mail_interactions');
begin
  assert (select count(*) from public.crm_interactions where contact_id = v and source = 'gmail') = 2, 'the new writer has two lines';
  assert (select body from public.crm_interactions where contact_id = v and direction = 'in') = 'Asks whether Welfare Avenue would partner on a food drive.', 'the line is the body';
  assert (select meta ->> 'mailbox' from public.crm_interactions where contact_id = 4001 and source = 'gmail') = 'info', 'info@ is its own mailbox';
  assert (select source_ref from public.crm_interactions where contact_id = v and direction = 'out') = 'steel:gm292A2:' || left(md5('new.writer@neworg.example.org'), 8), 'source_ref has no address';
  assert (r #>> '{lists,mail,by_direction,out}')::int = 1 and (r #>> '{lists,mail,by_mailbox,steel}')::int = 2, 'counts by mailbox and direction: ' || r::text;
  assert (r #>> '{lists,mail,first_contacts}')::int = 1, 'one first contact (the existing writer); the new writer answered: ' || r::text;
  assert not public.wa292_first_contact(v) and public.wa292_first_contact(4001), 'first contact follows the thread rule';
  assert (select threads from public.crm_email_relationship_v where contact_id = v) = 1, 'the view counts threads';
  assert pg_temp.err('select public.wa284_undo(' || pg_temp.batch('mail_people') || ', ''test'')') like 'wa284: email history: undo mail_interactions, mail_enrich first%', 'Undo goes bottom up';
end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
do $$ begin assert public.crm_email_first_contact(pg_temp.id('new')) = false and public.crm_email_first_contact(4001) = true, 'crm_email_first_contact has the clause'; end $$;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$
declare n int;
begin
  assert (select count(*) from public.crm_interactions where source = 'gmail' and meta ->> 'mailbox' = 'steel') = 0, 'a member does not read Steel''s lines';
  assert (select count(*) from public.crm_interactions where source = 'gmail') = 3, 'but reads hub@ and info@ lines';
  assert (select count(*) from public.crm_email_relationship where from_steel) = 0 and (select count(*) from public.crm_email_relationship) >= 1, 'nor Steel''s type rows';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
do $$
declare n int;
begin
  assert (select count(*) from public.crm_interactions where source = 'gmail' and meta ->> 'mailbox' = 'steel') = 2, 'an admin reads Steel''s lines';
  update public.crm_interactions set body = 'changed' where source = 'gmail';
  get diagnostics n = row_count;
  assert n = 0, 'nobody signed in updates an email line';
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
update public.app_config set value = 'true' where key = 'mail_history_steel_open';
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.member@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$ begin assert (select count(*) from public.crm_interactions where source = 'gmail' and meta ->> 'mailbox' = 'steel') = 2, 'one setting opens Steel''s lines (H1)'; end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
update public.app_config set value = 'false' where key = 'mail_history_steel_open';
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------- the summary pass
do $$
declare v bigint := pg_temp.id('new'); j jsonb;
begin
  j := public.crm_insight_input(v);
  assert (j ->> 'count')::int = 2 and (j ->> 'from_steel')::boolean and jsonb_array_length(j -> 'rows') = 2 and j -> 'rows' -> 0 ->> 'line' like 'Asks whether%', 'the input is the lines only';
  assert j::text !~ 'body', 'no body key';
  assert pg_temp.err('select public.crm_insight_save(' || v || ', ''{"summary": "See https://example.org"}'', ''test'')') like '%link%', 'a link is refused';
  assert pg_temp.err('select public.crm_insight_save(' || v || ', ''{"summary": "Fine", "body": "x"}'', ''test'')') like '%body%', 'a body key is refused';
  assert pg_temp.err('select public.crm_insight_save(' || v || ', ''{"summary": "Fine", "topics": ["gossip"]}'', ''test'')') like '%unknown topic%', 'an unknown topic is refused';
  perform public.crm_insight_save(v, '{"summary": "A partner organisation that offered a food drive in the spring.", "open_item": "A call to arrange.", "topics": ["partnership"], "model": "test-model", "cost": 0.004}', 'test');
  assert (select summary is not null and not stale and from_steel and rel_type = 'partner' and topics = array['partnership'] from public.crm_email_relationship where contact_id = v), 'the summary is saved on the type row';
  assert pg_temp.err('select public.wa292_summary_start(9200, ''test'')') like '%after the email lines%', 'the pass needs mail_interactions applied';
  j := public.wa292_summary_start(9201, 'test');
  assert (j ->> 'todo')::int = 3 and (select bool_and(phase = 'summaries') from public.crm_mail_scans where run_id = 9201), 'the pass starts with the rest waiting: ' || j::text;
  assert public.wa292_summary_active() = '[9201]'::jsonb, 'the pump sees it';
  perform public.wa292_summary_done(9201);
  assert (select bool_and(phase = 'summarised') from public.crm_mail_scans where run_id = 9201), 'and it finishes';
end $$;

-- ---------------------------------------------------------------- the merge keeps the row and marks it stale
select set_config('request.jwt.claims', '{"role":"authenticated","email":"w281.admin@example.invalid","sub":"00000000-0000-0000-0000-000000000002"}', true);
do $$
declare v bigint := pg_temp.id('new'); d bigint;
begin
  insert into public.crm_contacts (full_name, emails) values ('Test Duplicate Writer', array['dup.writer@example.org']) returning id into d;
  insert into public.crm_email_relationship (contact_id, rel_type, rel_conf, summary) values (9303, 'supporter', 0.7, 'A summary.'), (d, 'donor', 0.5, 'Another summary.');
  perform public.crm_merge_contacts(9303, d);
  assert (select stale and rel_type = 'supporter' from public.crm_email_relationship where contact_id = 9303) and not exists (select 1 from public.crm_email_relationship where contact_id = d), 'the kept row stays, marked stale';
end $$;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------- Undo bottom up, quarantine, Delete created
do $$
declare r jsonb; v bigint := pg_temp.id('new'); g bigint := pg_temp.id('general'); d jsonb;
begin
  update public.crm_email_relationship set summary = null, open_item = null, topics = '{}', model = null, cost = null, generated_at = null, generated_by = 'Email history' where contact_id = v;
  update public.crm_mail_scans set phase = 'done' where run_id = 9201;
  r := public.wa284_undo(pg_temp.batch('mail_interactions'), 'test');
  assert (select count(*) from public.crm_interactions where source = 'gmail') = 0, 'Undo removes the lines';
  r := public.wa284_undo(pg_temp.batch('mail_enrich'), 'test');
  assert (select job_title is null and tags = '{}' and kinds = '{}' from public.crm_contacts where id = 4001), 'enrich undone, value-checked';
  r := public.wa284_undo(pg_temp.batch('mail_people'), 'test');
  assert (select tags from public.crm_contacts where id = v) = array['email history', 'email history: review'] and r -> 'lists' -> 'quarantined' @> to_jsonb(array[v, g]), 'created and untouched: quarantined: ' || r::text;
  assert not exists (select 1 from public.crm_email_relationship where contact_id = v) and not exists (select 1 from public.crm_contact_orgs where contact_id = v), 'type rows and links removed';
  assert (select basis from public.crm_email_permission(v, 'volunteer')) = 'not for bulk email', 'a quarantined contact is kept out of every Send';
  assert pg_temp.err('select public.wa292_delete_created(' || pg_temp.batch('mail_enrich') || ', ''test'')') like '%undone mail_people batch only%', 'Delete created only on mail_people';
  d := public.wa292_delete_created(pg_temp.batch('mail_people'), 'test');
  assert (d ->> 'deleted')::int = 2 and pg_temp.contact('new.writer@neworg.example.org') is null, 'created and untouched contacts deleted: ' || d::text;
  assert exists (select 1 from public.crm_email_suppressions where addr_md5 = md5('new.writer@neworg.example.org') and kind = 'undo')
     and not exists (select 1 from public.crm_email_suppressions where addr_md5 = md5('new.writer@neworg.example.org') and kind = 'deleted'), 'recorded as undo, which blocks nothing';
  assert exists (select 1 from import_stage.mail_people where key = 'new.writer@neworg.example.org'), 'and the staging is kept for a new compare';
  assert exists (select 1 from public.wa_partners where name = 'Test New Org'), 'organisations are never deleted';
end $$;

-- ---------------------------------------------------------------- a staff deletion suppresses for good, and Purge keeps mail_seen
do $$
declare v bigint;
begin
  insert into public.crm_contacts (full_name, emails, legacy_refs) values ('Test Staff Deleted', array['existing.writer@org.example.org'], '{"email_history": {"run": 9201}}') returning id into v;
  delete from public.crm_contacts where id = v;
  assert exists (select 1 from public.crm_email_suppressions where addr_md5 = md5('existing.writer@org.example.org') and kind = 'deleted'), 'a deleted contact with email history is suppressed';
  assert not exists (select 1 from import_stage.mail_people where key = 'existing.writer@org.example.org') and not exists (select 1 from import_stage.mail_messages where writer = 'existing.writer@org.example.org'), 'and its staging rows go';
  perform public.wa284_purge(9201);
  assert not exists (select 1 from import_stage.mail_people where run_id = 9201) and not exists (select 1 from import_stage.mail_messages where run_id = 9201) and not exists (select 1 from import_stage.mail_orgs where run_id = 9201), 'Purge empties the mail staging';
  assert exists (select 1 from import_stage.mail_seen where gmail_id = 'gm292A1') and exists (select 1 from public.crm_email_suppressions), 'and keeps mail_seen and the suppressions';
  -- eh-289 I8: a run whose email lines were never applied gives its mail_seen hashes back
  insert into public.crm_import_runs (id, label, source) overriding system value values (9202, 'Test unapplied run', 'email_history');
  insert into import_stage.mail_seen (msg_md5, mailbox, gmail_id, run_id) values (md5('m9'), 'hub', 'gm292U1', 9202);
  perform public.wa284_purge(9202);
  assert not exists (select 1 from import_stage.mail_seen where gmail_id = 'gm292U1'), 'Purge of an unapplied run deletes its mail_seen rows';
  assert exists (select 1 from import_stage.mail_seen where gmail_id = 'gm292A1'), 'an applied run''s rows stay';
end $$;

select 'w292sql: all assertions passed' as result;
rollback;

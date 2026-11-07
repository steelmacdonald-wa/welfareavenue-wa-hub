-- wave292: checks on the live database, after slice 1 (build/data/wa281_rules.sql to wa288_toronto.sql), build/data/wa289_scan.sql and
-- build/data/wa292_batches.sql. Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back. No transaction control.
-- Raises on the first failure with the check's name only; personal data never leaves the database. The flow works on invented people only
-- (addresses at w292live.example.invalid, gmail ids w292LIVE...): a finished email-history run is staged by hand, the five batches are compared
-- and applied, undone bottom up, and the created contact is deleted with Delete created. Proved offline first by test/w292sql.mjs.

do $live$
declare v_run bigint; v_b bigint; r jsonb; v bigint; f record; k text;
begin
  -- structure
  if not (select relrowsecurity from pg_class where oid = 'public.crm_email_relationship'::regclass) then raise exception 'w292live: crm_email_relationship has no row level security'; end if;
  if has_table_privilege('anon', 'public.crm_email_relationship', 'select') or has_table_privilege('authenticated', 'public.crm_email_relationship', 'insert') then raise exception 'w292live: crm_email_relationship grants'; end if;
  if (select count(*) from pg_policy where polrelid = 'public.crm_interactions'::regclass and not polpermissive and polname like 'crm_interactions_wa292_%') <> 3 then raise exception 'w292live: the restrictive policies'; end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.crm_contacts'::regclass and tgname in ('trg_wa292_suppress', 'trg_wa292_suppress_del')) <> 2 then raise exception 'w292live: the suppression triggers'; end if;
  if (select confdeltype from pg_constraint where conname = 'crm_interactions_contact_id_fkey') <> 'c' then raise exception 'w292live: crm_interactions no longer cascades'; end if;
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'wa292\_%' or p.proname like 'crm_insight\_%') loop
    if has_function_privilege('authenticated', f.sig, 'execute') or has_function_privilege('anon', f.sig, 'execute') then raise exception 'w292live: % is open to signed-in users', f.sig; end if;
  end loop;
  foreach k in array array['wa284_write:wa292_write', 'wa284_basis:wa292_basis', 'wa284_new_batch:mail_interactions', 'wa284_undo:wa292_undo_check', 'wa284_unrow:crm_email_relationship',
                           'wa284_set:crm_email_relationship', 'wa284_upd:crm_email_relationship', 'wa284_purge:wa292_purge', 'wa282_first_contact_core:gmail',
                           'crm_email_permission:not for bulk email', 'crm_merge_contacts:crm_email_relationship'] loop
    if not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = split_part(k, ':', 1) and position(split_part(k, ':', 2) in pg_get_functiondef(p.oid)) > 0) then
      raise exception 'w292live: % lacks its wave292 text', split_part(k, ':', 1);
    end if;
  end loop;

  -- a finished email-history run, staged by hand with invented people
  insert into public.crm_import_runs (label, created_by, source) values ('w292live test run', 'w292live', 'email_history') returning id into v_run;
  insert into public.crm_mail_scans (run_id, mailbox, phase, counts, finished_at, go_at, cap_usd) values
    (v_run, 'steel', 'done', '{"run": {"outbound_only": 0}}', now(), now(), 1), (v_run, 'hub', 'done', '{"run": {"outbound_only": 0}}', now(), now(), 1);
  insert into import_stage.mail_people (run_id, key, writer, addresses, name, rel_type, rel_conf, lang, domain, mailboxes, match_kind)
  values (v_run, 'writer@w292live.example.invalid', true, array['writer@w292live.example.invalid'], 'Test Live Writer', 'supporter', 0.9, 'en', 'w292live.example.invalid', array['hub'], 'none');
  insert into import_stage.mail_messages (run_id, mailbox, gmail_id, thread_id, sent_at, state, direction, box, writer, subject, line, topic, read_at) values
    (v_run, 'hub', 'w292LIVE1', 'w292LIVEt', now() - interval '1 day', 'kept', 'in', 'hub', 'writer@w292live.example.invalid', 'Test subject', 'Asks a test question.', 'other', now());
  foreach k in array public.wa292_kinds() loop
    v_b := public.wa284_new_batch(v_run, k);
    r := public.wa284_compare(v_b, 'w292live');
    if r ? 'error' then raise exception 'w292live: compare % stopped: %', k, r ->> 'error'; end if;
    r := public.wa284_apply(v_b, 'w292live');
    if r::text ~ '@' then raise exception 'w292live: the % report holds an address', k; end if;
  end loop;
  select c.id into v from public.crm_contacts c where 'writer@w292live.example.invalid' = any(c.emails);
  if v is null or not exists (select 1 from public.crm_contacts c where c.id = v and 'email history' = any(c.tags)) then raise exception 'w292live: the writer was not created'; end if;
  if (select count(*) from public.crm_interactions where contact_id = v and source = 'gmail') <> 1 then raise exception 'w292live: the email line'; end if;
  if (select rel_type from public.crm_email_relationship where contact_id = v) <> 'supporter' then raise exception 'w292live: the type row'; end if;
  if (select (crm_insight_input(v) ->> 'count')::int) <> 1 then raise exception 'w292live: crm_insight_input'; end if;
  -- Undo goes bottom up
  begin
    perform public.wa284_undo((select id from public.crm_import_batches where run_id = v_run and kind = 'mail_people'), 'w292live');
    k := 'allowed';
  exception when others then
    k := sqlerrm;
  end;
  if k not like 'wa284: email history: undo % first%' then raise exception 'w292live: undo out of order was not refused'; end if;
end $live$;

do $live$
declare v_run bigint := (select id from public.crm_import_runs where label = 'w292live test run'); v bigint; r jsonb; k text;
begin
  foreach k in array array['mail_interactions', 'mail_enrich', 'mail_people', 'mail_orgs'] loop
    r := public.wa284_undo((select id from public.crm_import_batches where run_id = v_run and kind = k), 'w292live');
  end loop;
  select c.id into v from public.crm_contacts c where 'writer@w292live.example.invalid' = any(c.emails);
  if not exists (select 1 from public.crm_contacts c where c.id = v and 'email history: review' = any(c.tags)) then raise exception 'w292live: the undone contact was not quarantined'; end if;
  r := public.wa292_delete_created((select id from public.crm_import_batches where run_id = v_run and kind = 'mail_people'), 'w292live');
  if (r ->> 'deleted')::int <> 1 or exists (select 1 from public.crm_contacts where id = v) then raise exception 'w292live: Delete created'; end if;
  if not exists (select 1 from public.crm_email_suppressions where addr_md5 = md5('writer@w292live.example.invalid') and kind = 'undo') then raise exception 'w292live: the undo suppression'; end if;
  perform public.wa284_purge(v_run);
  if exists (select 1 from import_stage.mail_people where run_id = v_run) then raise exception 'w292live: purge left the staging'; end if;
  raise notice 'w292live: every check passed';
end $live$;

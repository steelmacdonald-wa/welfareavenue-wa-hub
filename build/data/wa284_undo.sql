-- Welfare Avenue Hub: wave284 undo, 06/11/26. Takes the Import page's database objects out again (build/data/wa284_import.sql).
-- Before running it: undo, on the Import page, every applied batch that should be undone (a batch's own Undo needs its change records, which this
-- file drops), then purge every run (Purge this run deletes the staged rows and the uploaded files). What the batches wrote stays: contacts,
-- organisations, fields, consent log rows and timeline items are data now, and opt-outs and consent are never undone.
-- wave284 changed no live function, so there is no live text to put back. It drops: the guard trigger on the nine tables, the wa284_* functions,
-- crm_import_changes, crm_import_batches, crm_import_runs, the schema import_stage, the storage policies, the Keela id index; the bucket imports
-- when it is empty; the keela_ settings wave284 added, when they still hold the value wave284 gave them (a setting an admin filled in stays).
-- Safe to run twice. No transaction control. Proved offline: node test/w284sql.mjs.
-- Order (eh-289 I7): undo wave293, then wave292, then wave289, then this file. Its drop of import_stage would take wave289's staging tables with it,
-- so it stops while wave289 is there.

do $wa284u0$
begin
  if to_regclass('public.crm_mail_scans') is not null then raise exception 'wave284 undo: undo wave289 first (build/data/wa289_undo.sql)'; end if;
end $wa284u0$;

do $wa284u$
declare t text;
begin
  foreach t in array array['dept_requests', 'crm_email_sends', 'quo_messages', 'whatsapp_messages', 'crm_automation_runs', 'hub_notifications_sent',
                           'volunteer_applications', 'crm_form_submissions', 'event_roster'] loop
    if to_regclass('public.' || t) is not null then execute format('drop trigger if exists trg_wa284_import_guard on public.%I', t); end if;
  end loop;
end $wa284u$;

drop policy if exists wa284_imports_insert on storage.objects;
drop policy if exists wa284_imports_select on storage.objects;
drop policy if exists wa284_imports_delete on storage.objects;

do $wa284u$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'wa284\_%' loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end $wa284u$;

drop table if exists public.crm_import_changes;
drop table if exists public.crm_import_batches;
drop schema if exists import_stage cascade;
drop table if exists public.crm_import_runs;
drop index if exists public.crm_contacts_wa284_keela_idx;

-- the bucket: removed only when it holds no file
do $wa284u$
begin
  if not exists (select 1 from storage.buckets b where b.id = 'imports') then return; end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'imports') then
    raise notice 'wave284 undo: the imports bucket still holds files; purge the runs first, then run this again to remove it';
    return;
  end if;
  begin
    delete from storage.buckets b where b.id = 'imports';
  exception when others then
    raise notice 'wave284 undo: the imports bucket was left in place (%); remove it in the dashboard', sqlstate;
  end;
end $wa284u$;

-- the settings, when they still hold wave284's value
delete from public.app_config c
 using (values
    ('keela_assignee_map', '{}'),
    ('keela_org_pairs_ok', '[]'),
    ('keela_company_category_map', '{}'),
    ('keela_status_map', '{"To contact": "prospect", "Developing": "prospect", "Established relationship": "active"}'),
    ('keela_tag_map', '{"Rally Paper Participant": {"campaign": "Rally Paper 2026", "part": "participant"}, "Flag Football 2025": {"campaign": "Football Fundraiser 2025", "part": "participant"}, "2026 Gift Basket Volunteer": {"campaign": "Gift Basket Drive 2026", "part": "volunteer"}, "Toronto Contacts": {"chapter": "toronto"}, "Toronto Volunteers": {"chapter": "toronto"}, "Welcome Series Exit #1": {"skip": true}, "Donor": {"skip": true}, "Past Donor": {"skip": true}, "Reoccurring Donor": {"skip": true}}'),
    ('keela_keys', '{}'),
    ('keela_campaign_types', '{}')
  ) as x(k, v)
 where c.key = x.k and c.value = x.v;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave284', 'wave284 undo', null, 'The Import page''s database objects were removed (wa284_undo.sql); the data the batches wrote stays.', 'wave284'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave284' and field = 'wave284 undo');

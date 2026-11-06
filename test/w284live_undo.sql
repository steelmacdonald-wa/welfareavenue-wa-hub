-- wave284: checks on the live database after build/data/wa284_undo.sql (run twice), inside the block build/sql_rollback_test.py prints, so
-- everything rolls back. No transaction control. Raises on the first failure with the check's name only. Expects test/w284live.sql to have run
-- before the undo (its invented contacts, W284LIVE-..., are data the import wrote: they stay).

do $live$
begin
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'wa284\_%') then raise exception 'w284live_undo: a wa284_ function is left'; end if;
  if to_regclass('public.crm_import_runs') is not null or to_regclass('public.crm_import_batches') is not null or to_regclass('public.crm_import_changes') is not null then
    raise exception 'w284live_undo: an import table is left';
  end if;
  if to_regnamespace('import_stage') is not null then raise exception 'w284live_undo: import_stage is left'; end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_wa284_import_guard') then raise exception 'w284live_undo: a guard trigger is left'; end if;
  if exists (select 1 from pg_policy where polrelid = 'storage.objects'::regclass and polname like 'wa284_imports_%') then raise exception 'w284live_undo: a storage policy is left'; end if;
  if to_regclass('public.crm_contacts_wa284_keela_idx') is not null then raise exception 'w284live_undo: the Keela id index is left'; end if;
  if exists (select 1 from public.app_config where key in ('keela_assignee_map', 'keela_org_pairs_ok', 'keela_company_category_map', 'keela_status_map', 'keela_tag_map', 'keela_campaign_types')) then
    raise exception 'w284live_undo: a mapping setting wave284 seeded and nobody changed is left';
  end if;
  if not exists (select 1 from public.app_config where key = 'keela_keys') then raise exception 'w284live_undo: the keys setting the check filled in was removed'; end if;
  if not exists (select 1 from public.crm_contacts where legacy_refs -> 'keela' ->> 'contact_id' = 'W284LIVE-P1') then raise exception 'w284live_undo: data the import wrote was removed'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave284' and field = 'wave284 undo') <> 1 then raise exception 'w284live_undo: not one undo line'; end if;
end $live$;

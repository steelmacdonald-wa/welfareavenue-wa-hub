-- wave292: checks after build/data/wa292_undo.sql, on live inside build/sql_rollback_test.py's block (everything rolls back) or offline in
-- test/w292sql.mjs. No transaction control. Raises with the check's name only.

do $live$
declare k text;
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'wa292\_%' or proname like 'crm_insight\_%') and proname <> 'wa292_suppress_check') then raise exception 'w292live_undo: wa292 functions left'; end if;
  if exists (select 1 from pg_trigger where tgname like 'trg_wa292%' and tgname <> 'trg_wa292_suppress') then raise exception 'w292live_undo: triggers left'; end if;
  -- eh-292 minor: the suppression trigger stays with wave289's table, and the backup table is gone
  if not exists (select 1 from pg_trigger where tgname = 'trg_wa292_suppress') or to_regprocedure('public.wa292_suppress_check()') is null then raise exception 'w292live_undo: the suppression trigger went'; end if;
  if to_regclass('public.wa292_fn_backup') is not null then raise exception 'w292live_undo: the backup table is left'; end if;
  if exists (select 1 from pg_policy where polname = 'crm_interactions_wa292_no_insert') then raise exception 'w292live_undo: the insert policy is left'; end if;
  if exists (select 1 from pg_policy where polname like 'crm_interactions_wa292%') then raise exception 'w292live_undo: policies left'; end if;
  if to_regclass('public.crm_email_relationship_v') is not null then raise exception 'w292live_undo: the view is left'; end if;
  foreach k in array array['wa284_write:wa292_', 'wa284_basis:wa292_', 'wa284_new_batch:mail_interactions', 'wa284_undo:wa292_', 'wa284_unrow:crm_email_relationship',
                           'wa284_set:crm_email_relationship', 'wa284_upd:crm_email_relationship', 'wa284_purge:wa292_', 'wa282_first_contact_core:gmail',
                           'crm_email_permission:not for bulk email', 'crm_merge_contacts:crm_email_relationship'] loop
    if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = split_part(k, ':', 1) and position(split_part(k, ':', 2) in pg_get_functiondef(p.oid)) > 0) then
      raise exception 'w292live_undo: % still has wave292 text', split_part(k, ':', 1);
    end if;
  end loop;
  if to_regclass('public.crm_email_suppressions') is null then raise exception 'w292live_undo: the suppressions went'; end if;
  raise notice 'w292live_undo: every check passed';
end $live$;

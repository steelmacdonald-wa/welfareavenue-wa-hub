-- wave289: checks after build/data/wa289_undo.sql, on live inside build/sql_rollback_test.py's block (everything rolls back) or offline in
-- test/w289sql.mjs. No transaction control. Raises with the check's name only.

do $live$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like 'wa289\_%') then raise exception 'w289live_undo: wa289 functions left'; end if;
  if to_regclass('public.crm_mail_scans') is not null or to_regclass('public.crm_email_suppressions') is not null then raise exception 'w289live_undo: tables left'; end if;
  if to_regclass('import_stage.mail_messages') is not null or to_regclass('import_stage.mail_seen') is not null or to_regclass('import_stage.mail_left_alone') is not null then
    raise exception 'w289live_undo: staging tables left';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and ((table_name = 'ai_routes' and column_name = 'provider') or (table_name = 'crm_import_runs' and column_name = 'source'))) then
    raise exception 'w289live_undo: columns left';
  end if;
  if exists (select 1 from public.ai_routes where task like 'mail\_history\_%') then raise exception 'w289live_undo: routes left'; end if;
  if exists (select 1 from cron.job where jobname = 'wa-mail-history-pump') then raise exception 'w289live_undo: the pump is left'; end if;
  if to_regclass('import_stage.files') is null then raise exception 'w289live_undo: wave284''s staging went too'; end if;
  raise notice 'w289live_undo: every check passed';
end $live$;

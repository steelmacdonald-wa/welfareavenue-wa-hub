-- wave293: checks after build/data/wa293_undo.sql, on live inside build/sql_rollback_test.py's block (everything rolls back) or offline in
-- test/w293sql.mjs. No transaction control. Raises with the check's name only.

do $live$
begin
  if to_regprocedure('public.crm_insights_overview()') is not null then raise exception 'w293live_undo: crm_insights_overview is left'; end if;
  if to_regclass('public.crm_email_relationship') is null then raise exception 'w293live_undo: wave292''s table went with it'; end if;
  raise notice 'w293live_undo: every check passed';
end $live$;

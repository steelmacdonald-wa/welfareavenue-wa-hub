-- wave290: assertions after build/data/wa290_undo.sql. Runs only inside the block build/sql_rollback_test.py prints (before snapshot, the
-- migration, the undo twice, this file, then the migration again and test/w290live.sql), so everything rolls back. No transaction control.

do $undo_check$
declare e record;
begin
  select * into e from pg_temp.w290_expect;
  if md5(pg_get_functiondef('public.wa191_onb_signup(bigint[],text,text)'::regprocedure)) <> e.signup_md5 then raise exception 'w290live_undo: wa191_onb_signup is not back to its live text'; end if;
  if (select p.proacl::text from pg_proc p where p.oid = 'public.wa191_onb_signup(bigint[],text,text)'::regprocedure) is distinct from e.signup_acl then raise exception 'w290live_undo: wa191_onb_signup grants changed'; end if;
  if obj_description('public.wa191_onb_signup(bigint[],text,text)'::regprocedure, 'pg_proc') is distinct from e.signup_comment then raise exception 'w290live_undo: wa191_onb_signup comment is not back'; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'wa290%') then raise exception 'w290live_undo: a wa290 function is left'; end if;
  if exists (select 1 from public.app_config c where c.key = 'servings_card_from') then raise exception 'w290live_undo: servings_card_from is left'; end if;
  raise notice 'w290live_undo: live is back as it was';
end $undo_check$;

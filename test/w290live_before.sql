-- wave290: the before snapshot. Runs first, inside the block build/sql_rollback_test.py prints, so it rolls back with everything else.
-- No transaction control. Keeps what the checks compare against (the live sign-up function's md5, grants and comment) in a temporary table,
-- and stops if live is not what wave290 was built on.

create temporary table w290_expect as
select md5(pg_get_functiondef('public.wa191_onb_signup(bigint[],text,text)'::regprocedure)) as signup_md5,
       (select p.proacl::text from pg_proc p where p.oid = 'public.wa191_onb_signup(bigint[],text,text)'::regprocedure) as signup_acl,
       obj_description('public.wa191_onb_signup(bigint[],text,text)'::regprocedure, 'pg_proc') as signup_comment,
       (select count(*) from public.app_config c where c.key = 'servings_card_from') as cfg_rows,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'wa290%') as wa290_functions;

do $before$
declare e record;
begin
  select * into e from pg_temp.w290_expect;
  if e.signup_md5 <> 'fa51b5d8f40d7ec15d8efd97f661c125' then raise exception 'w290live_before: wa191_onb_signup is not the text wave290 was built on (md5 %)', e.signup_md5; end if;
  if e.cfg_rows <> 0 then raise exception 'w290live_before: app_config servings_card_from is already set'; end if;
  if e.wa290_functions <> 0 then raise exception 'w290live_before: a wa290 function already exists'; end if;
  raise notice 'w290live_before: live is as wave290 expects';
end $before$;

-- wave283: the live state just before the migration (and after wave281's, which is not live yet), kept in temp tables for test/w283live.sql and
-- test/w283live_undo.sql. Runs only inside the block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql, so everything rolls back.
-- No transaction control. Reads only. Personal data stays in the database: the later files compare inside it and raise only counts and check names.

create temp table w283_fn_before as
  select format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) as f, md5(pg_get_functiondef(p.oid)) as def_md5, obj_description(p.oid, 'pg_proc') as cmt,
         has_function_privilege('anon', p.oid, 'execute') as anon_x, has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
         has_function_privilege('service_role', p.oid, 'execute') as svc_x, p.proacl::text as acl
    from pg_proc p
   where p.oid in ('public.crm_receipt_issue(bigint[])'::regprocedure, 'public.crm_receipt_replace(bigint,text)'::regprocedure, 'public.crm_receipt_cancel(bigint,text)'::regprocedure,
                   'public.crm_receipt_config()'::regprocedure, 'public.crm_receipt_doc(bigint)'::regprocedure);

create temp table w283_policy_before as
  select polname, polcmd::text as cmd, polpermissive, polroles::regrole[]::text as roles, pg_get_expr(polqual, polrelid) as q, pg_get_expr(polwithcheck, polrelid) as chk
    from pg_policy where polrelid = 'public.crm_donations'::regclass;

create temp table w283_trigger_before as
  select tgname, pg_get_triggerdef(t.oid) as def from pg_trigger t where tgrelid = 'public.crm_donations'::regclass and not tgisinternal;

create temp table w283_expect as
  select (select count(*) from public.crm_donations) as gifts,
         (select md5(string_agg(to_jsonb(d)::text, '|' order by d.id)) from public.crm_donations d) as gifts_md5,
         (select count(*) from public.change_log where entity_type = 'crm_donations' and field = 'gift') as gift_log_rows,
         (select count(*) from public.hub_i18n where lang = 'fr') as i18n_rows,
         (select tr from public.hub_i18n where lang = 'fr' and en = 'Send') as send_tr,
         (select count(*) from public.hub_i18n where lang = 'fr' and en in ('Sends', 'Imports', 'Do not contact')) as words_before;

do $b$
begin
  if (select count(*) from pg_temp.w283_fn_before) <> 5 then raise exception 'w283live_before: not five receipt functions'; end if;
  if (select string_agg(polname, ',' order by polname) from pg_temp.w283_policy_before)
     <> 'crm_donations_admin_delete,crm_donations_staff_insert,crm_donations_staff_read,crm_donations_staff_update' then
    raise exception 'w283live_before: crm_donations has other policies than the four the brief names';
  end if;
  if to_regprocedure('public.wa_can(text)') is null then raise exception 'w283live_before: wave281 must run first (wa_can is missing)'; end if;
end $b$;

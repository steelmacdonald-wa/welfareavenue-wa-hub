-- wave282: the live state just before the migration (after wave281), kept in temp tables for test/w282live.sql and test/w282live_undo.sql.
-- Runs only inside the block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql and before build/data/wa282_mail_rule.sql, so
-- everything rolls back. No transaction control. Reads only. Personal data stays in the database: the later files compare inside it and raise only
-- counts and names of checks.

create temp table w282_fn_before as
  select md5(pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure)) as def_md5,
         obj_description('public.crm_email_permission(bigint,text)'::regprocedure, 'pg_proc') as cmt,
         (select proacl::text from pg_proc where oid = 'public.crm_email_permission(bigint,text)'::regprocedure) as acl;

-- what every live contact may be emailed, for each kind, before the change
create temp table w282_perm_before as
  select c.id, k.kind, p.allowed, p.basis
    from public.crm_contacts c
    cross join (values ('transactional'), ('newsletter'), ('fundraising'), ('volunteer')) k(kind)
    cross join lateral public.crm_email_permission(c.id, k.kind) p
   where c.merged_into is null;

create temp table w282_state_before as
  select (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.crm_campaigns'::regclass and conname = 'crm_campaigns_kind_check') as kind_check,
         col_description('public.crm_campaigns'::regclass, (select attnum from pg_attribute where attrelid = 'public.crm_campaigns'::regclass and attname = 'kind')) as kind_cmt,
         (select value from public.app_config where key = 'mail_fundraising_exemption') as setting,
         (select count(*) from public.crm_campaigns) as sends,
         (select count(*) from public.crm_lists) as lists,
         (select count(*) from public.crm_contacts) as contacts,
         (select count(*) from public.crm_email_sends) as deliveries;

do $before$
begin
  if (select setting from pg_temp.w282_state_before) is distinct from 'off' then raise exception 'w282live_before: mail_fundraising_exemption is not off'; end if;
  if (select sends from pg_temp.w282_state_before) <> 0 then raise exception 'w282live_before: there are Sends (the design counted 0)'; end if;
  if position('do not contact' in pg_get_functiondef('public.crm_email_permission(bigint,text)'::regprocedure)) = 0 then raise exception 'w282live_before: wave281 has not run first'; end if;
end $before$;

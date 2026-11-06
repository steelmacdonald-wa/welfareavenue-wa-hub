-- wave281: the live state just before the migration, kept in temp tables for test/w281live.sql and test/w281live_undo.sql.
-- Runs only inside the block build/sql_rollback_test.py prints, first in the list, so everything rolls back. No transaction control.
-- Reads only. Personal data stays in the database: the later files compare inside it and raise only counts and names of checks.

create temp table w281_fn_before as
  select format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) as f, md5(pg_get_functiondef(p.oid)) as def_md5, obj_description(p.oid, 'pg_proc') as cmt,
         has_function_privilege('anon', p.oid, 'execute') as anon_x, has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
         has_function_privilege('service_role', p.oid, 'execute') as svc_x
    from pg_proc p
   where p.oid in ('public.crm_email_permission(bigint,text)'::regprocedure, 'public.wa171_opted_out(bigint,text)'::regprocedure, 'public.wa171_inbound(jsonb)'::regprocedure,
                   'public.wa254_inbound(jsonb)'::regprocedure, 'public.crm_refresh_implied_consent()'::regprocedure, 'public.crm_merge_contacts(bigint,bigint)'::regprocedure,
                   'public.wa_app_config_guard()'::regprocedure, 'public.crm_contact_match(public.crm_contacts_v,jsonb)'::regprocedure);

create temp table w281_view_before as
  select md5(pg_get_viewdef('public.crm_contacts_v'::regclass, true)) as def_md5, obj_description('public.crm_contacts_v'::regclass, 'pg_class') as cmt,
         (select reloptions::text from pg_class where oid = 'public.crm_contacts_v'::regclass) as opts,
         (select string_agg(r || ':' || p, ',' order by r, p) from unnest(array['anon', 'authenticated', 'service_role']) r,
                 unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
           where has_table_privilege(r, 'public.crm_contacts_v', p)) as privs;

create temp table w281_policy_before as
  select pg_get_expr(polwithcheck, polrelid) as chk, polcmd::text as cmd, polroles::regrole[]::text as roles from pg_policy where polname = 'hub_roles_self_member';

-- what every contact may be emailed, for each kind, and who may be texted, before the change
create temp table w281_perm_before as
  select c.id, k.kind, p.allowed, p.basis
    from public.crm_contacts c
    cross join (values ('transactional'), ('newsletter'), ('fundraising'), ('volunteer')) k(kind)
    cross join lateral public.crm_email_permission(c.id, k.kind) p
   where c.merged_into is null;
create temp table w281_opt_before as
  select x.phone, public.wa171_opted_out(null, x.phone) as opted_out
    from (select unnest(c.phones) as phone from public.crm_contacts c where c.merged_into is null
          union select q.phone from public.quo_messages q where q.direction = 'in') x
   where public.wa171_digits(x.phone) is not null;
create temp table w281_vol_before as
  select c.volunteer_id, public.wa171_opted_out(c.volunteer_id, null) as opted_out from public.crm_contacts c where c.volunteer_id is not null and c.merged_into is null;
create temp table w281_view_rows_before as
  select md5(string_agg(to_jsonb(v)::text, '|' order by v.id)) as m, count(*) as n from public.crm_contacts_v v;

-- what the backfills should give, worked out from the live rows by the rules in the brief
create temp table w281_expect as
  select
    (select count(*) from public.crm_contacts c where c.merged_into is null
       and (exists (select 1 from unnest(c.tags) t where t ilike '%toronto%')
            or (jsonb_typeof(c.legacy_refs -> 'keela' -> 'tags') = 'array' and exists (select 1 from jsonb_array_elements_text(c.legacy_refs -> 'keela' -> 'tags') t where t ilike '%toronto%')))) as toronto,
    (select count(*) from public.crm_contacts c where c.merged_into is null and (
          (c.volunteer_id is not null and exists (select 1 from public.event_roster r join public.volunteer_events e on e.id = r.event_id where r.person_id = c.volunteer_id and r.status = 'Confirmed' and e.status = 'completed'))
       or exists (select 1 from public.crm_volunteer_history h where h.contact_id = c.id and h.attended)
       or exists (select 1 from public.crm_form_submissions s join public.crm_forms f on f.id = s.form_id where s.contact_id = c.id and s.status = 'processed' and f.settings ->> 'city' = 'Montreal')
       or exists (select 1 from public.volunteer_applications a where a.contact_id = c.id or (c.volunteer_id is not null and a.person_id = c.volunteer_id)))) as montreal,
    (select count(*) from public.crm_form_submissions s join public.crm_contacts c on c.id = s.contact_id
      where s.consent is not null and s.status = 'processed' and not s.is_test) as form_consent,
    (select count(*) from public.change_log l join public.crm_contacts c on c.id::text = l.entity_id
      where l.entity_type in ('crm_contact', 'crm_contacts') and l.field in ('email_permission', 'email_status', 'email_consent', 'sms_opt_out')) as change_log_rows,
    (select count(*) from public.crm_donations d where lower(btrim(d.campaign)) in ('rally paper 2026', 'football fundraiser 2025', 'football fundraiser 2026', 'program development',
       'collaborative sunday servings', 'holiday gift baskets', 'gift basket drive 2026', 'holiday gift basket drive 2026')) as gifts,
    (select count(*) from public.crm_forms where settings ->> 'campaign' = 'gift-basket-drive') as forms,
    (select count(*) from public.crm_contacts) as contacts,
    (select count(*) from public.crm_donations) as donations;

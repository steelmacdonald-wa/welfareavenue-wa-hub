-- wave288: the live state just before the migration (and after wave281's and wave283's, which are not live yet), kept in temp tables for
-- test/w288live.sql and test/w288live_undo.sql. Runs only inside the block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql and
-- build/data/wa283_page.sql, so everything rolls back. No transaction control. Reads only. Personal data stays in the database: the later files
-- compare inside it and raise only counts and check names.

create temp table w288_fn_before as
  select format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) as f, md5(pg_get_functiondef(p.oid)) as def_md5, obj_description(p.oid, 'pg_proc') as cmt,
         p.proacl::text as acl
    from pg_proc p
   where p.oid in ('public.crm_form_apply(bigint)'::regprocedure, 'public.wa209_volunteer_apply(jsonb)'::regprocedure);

create temp table w288_form_before as
  select f.slug, md5(to_jsonb(f)::text) as all_md5, f.settings, f.consent, f.status,
         md5((to_jsonb(f) - 'settings' - 'consent' - 'status' - 'updated_at' - 'updated_by' - 'closed_at')::text) as rest_md5
    from public.crm_forms f;

create temp table w288_expect as
  select (select count(*) from public.crm_forms) as forms,
         (select count(*) from public.request_types) as rtypes,
         (select md5(string_agg(to_jsonb(r)::text, '|' order by r.id)) from public.request_types r) as rtypes_md5,
         (select count(*) from public.dept_requests) as requests,
         (select count(*) from public.volunteer_applications) as apps,
         (select md5(string_agg(to_jsonb(a)::text, '|' order by a.id)) from public.volunteer_applications a) as apps_md5,
         (select count(*) from public.hub_i18n where lang = 'fr') as i18n_rows,
         (select count(*) from public.hub_i18n where lang = 'fr' and en = 'Also ask for text consent') as word_before,
         (select count(*) from public.crm_contact_chapters) as chapter_rows,
         (select count(*) from public.crm_contact_fields) as field_rows,
         (select count(*) from public.crm_consent_events) as consent_rows,
         (select md5(string_agg(to_jsonb(c)::text, '|' order by c.id)) from public.crm_contacts c) as contacts_md5;

do $b$
begin
  if (select count(*) from pg_temp.w288_fn_before) <> 2 then raise exception 'w288live_before: not the two functions'; end if;
  if (select def_md5 from pg_temp.w288_fn_before where f = 'public.crm_form_apply(bigint)') <> 'dafd2ac5644c0d3b3e9462503a557158' then
    raise exception 'w288live_before: crm_form_apply is not the text wave288 and its undo were written against';
  end if;
  if (select def_md5 from pg_temp.w288_fn_before where f = 'public.wa209_volunteer_apply(jsonb)') <> '2031a8733e7f27abfe9321d477e7b692' then
    raise exception 'w288live_before: wa209_volunteer_apply is not the text wave288 and its undo were written against';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_applications' and column_name = 'chapter') then
    raise exception 'w288live_before: volunteer_applications.chapter is already there';
  end if;
  if exists (select 1 from public.request_types where key = 'toronto-volunteer') then raise exception 'w288live_before: the request type toronto-volunteer is already there'; end if;
  if exists (select 1 from public.crm_forms where slug in ('benevole-toronto', 'toronto-student', 'etudiant-toronto')) then raise exception 'w288live_before: a new form''s slug is taken'; end if;
  if not exists (select 1 from public.crm_forms where slug = 'toronto-volunteer') or not exists (select 1 from public.crm_forms where slug = 'volunteer') then
    raise exception 'w288live_before: the toronto-volunteer or volunteer form is missing';
  end if;
  if exists (select 1 from public.crm_contacts c where exists (select 1 from unnest(c.emails) x where lower(x) like '%@toronto-fixture.ca' or lower(x) like '%@montreal-fixture.ca')) then
    raise exception 'w288live_before: a contact already uses a fixture domain';
  end if;
  if to_regprocedure('public.crm_add_chapter(bigint,text,text,text)') is null then raise exception 'w288live_before: wave281 must run first (crm_add_chapter is missing)'; end if;
end $b$;

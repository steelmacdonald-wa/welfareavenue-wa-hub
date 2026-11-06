-- wave285: assertions on the live database after build/data/wa285_undo.sql (run after test/w285live_before.sql, the migration and the undo, inside the
-- block build/sql_rollback_test.py prints, so everything rolls back). No transaction control. Raises on the first failure with the check's name only.
-- The two functions, the forms, the request types, volunteer_applications and hub_i18n must be exactly as before the migration (toronto-volunteer's
-- updated_at and updated_by say the undo touched it).

do $u$
declare e record; fn record;
begin
  select * into e from pg_temp.w285_expect;
  for fn in select b.*, md5(pg_get_functiondef(b.f::regprocedure)) as now_md5, (select proacl::text from pg_proc where oid = b.f::regprocedure) as now_acl,
                  obj_description(b.f::regprocedure, 'pg_proc') as now_cmt from pg_temp.w285_fn_before b loop
    if fn.now_md5 <> fn.def_md5 then raise exception 'w285live_undo: % is not back exactly (definition)', fn.f; end if;
    if fn.now_acl is distinct from fn.acl then raise exception 'w285live_undo: % grants are not back', fn.f; end if;
    if fn.now_cmt is distinct from fn.cmt then raise exception 'w285live_undo: % comment is not back', fn.f; end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_applications' and column_name = 'chapter') then
    raise exception 'w285live_undo: volunteer_applications.chapter is still there';
  end if;
  if (select count(*) from public.volunteer_applications) <> e.apps or (select md5(string_agg(to_jsonb(a)::text, '|' order by a.id)) from public.volunteer_applications a) is distinct from e.apps_md5 then
    raise exception 'w285live_undo: the applications are not back';
  end if;
  if (select count(*) from public.request_types) <> e.rtypes or (select md5(string_agg(to_jsonb(r)::text, '|' order by r.id)) from public.request_types r) is distinct from e.rtypes_md5 then
    raise exception 'w285live_undo: the request types are not back';
  end if;
  if (select count(*) from public.crm_forms) <> e.forms then raise exception 'w285live_undo: the new forms are still there'; end if;
  if exists (select slug, all_md5 from pg_temp.w285_form_before where slug <> 'toronto-volunteer' except select slug, md5(to_jsonb(f)::text) from public.crm_forms f) then
    raise exception 'w285live_undo: another form is not as before';
  end if;
  if exists (select 1 from public.crm_forms f join pg_temp.w285_form_before b on b.slug = f.slug where f.slug = 'toronto-volunteer'
              and (f.settings is distinct from b.settings or f.consent is distinct from b.consent or f.status is distinct from b.status
                   or md5((to_jsonb(f) - 'settings' - 'consent' - 'status' - 'updated_at' - 'updated_by' - 'closed_at')::text) is distinct from b.rest_md5)) then
    raise exception 'w285live_undo: toronto-volunteer is not back as it was';
  end if;
  if (select count(*) from public.hub_i18n where lang = 'fr') <> e.i18n_rows then raise exception 'w285live_undo: hub_i18n is not back'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave285' and field = 'wave285 undo') <> 1 then raise exception 'w285live_undo: not one undo line'; end if;
  if (select md5(string_agg(to_jsonb(c)::text, '|' order by c.id)) from public.crm_contacts c) is distinct from e.contacts_md5 then raise exception 'w285live_undo: a contact changed'; end if;
end $u$;

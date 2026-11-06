-- wave283: assertions on the live database after build/data/wa283_undo.sql (run after test/w283live_before.sql, the migration and the undo, inside the
-- block build/sql_rollback_test.py prints, so everything rolls back). No transaction control. Raises on the first failure with the check's name only.
-- The five receipt functions, the crm_donations policies and triggers and hub_i18n must be exactly as before the migration.

do $u$
declare e record; f record;
begin
  select * into e from pg_temp.w283_expect;
  for f in select b.*, md5(pg_get_functiondef(b.f::regprocedure)) as now_md5, (select proacl::text from pg_proc where oid = b.f::regprocedure) as now_acl,
                  obj_description(b.f::regprocedure, 'pg_proc') as now_cmt from pg_temp.w283_fn_before b loop
    if f.now_md5 <> f.def_md5 then raise exception 'w283live_undo: % is not back exactly (definition)', f.f; end if;
    if f.now_acl is distinct from f.acl then raise exception 'w283live_undo: % grants are not back', f.f; end if;
    if f.now_cmt is distinct from f.cmt then raise exception 'w283live_undo: % comment is not back', f.f; end if;
  end loop;
  if exists (select polname, cmd, polpermissive, roles, q, chk from pg_temp.w283_policy_before
             except select polname, polcmd::text, polpermissive, polroles::regrole[]::text, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) from pg_policy where polrelid = 'public.crm_donations'::regclass)
     or exists (select polname, polcmd::text, polpermissive, polroles::regrole[]::text, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) from pg_policy where polrelid = 'public.crm_donations'::regclass
                except select polname, cmd, polpermissive, roles, q, chk from pg_temp.w283_policy_before) then
    raise exception 'w283live_undo: the crm_donations policies are not back exactly';
  end if;
  if exists (select tgname, def from pg_temp.w283_trigger_before except select tgname, pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid = 'public.crm_donations'::regclass and not tgisinternal)
     or exists (select tgname, pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid = 'public.crm_donations'::regclass and not tgisinternal except select tgname, def from pg_temp.w283_trigger_before) then
    raise exception 'w283live_undo: the crm_donations triggers are not back';
  end if;
  if to_regprocedure('public.wa283_gift_audit()') is not null then raise exception 'w283live_undo: wa283_gift_audit is still there'; end if;
  if (select count(*) from public.hub_i18n where lang = 'fr') <> e.i18n_rows or (select tr from public.hub_i18n where lang = 'fr' and en = 'Send') is distinct from e.send_tr then
    raise exception 'w283live_undo: hub_i18n is not back';
  end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave283' and field = 'wave283 undo') <> 1 then raise exception 'w283live_undo: not one undo line'; end if;
  if (select count(*) from public.crm_donations) <> e.gifts or (select md5(string_agg(to_jsonb(d)::text, '|' order by d.id)) from public.crm_donations d) is distinct from e.gifts_md5 then
    raise exception 'w283live_undo: a gift changed';
  end if;
end $u$;

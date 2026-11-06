-- wave281: checks on the live database after build/data/wa281_rules.sql and then build/data/wa281_undo.sql (run twice). Runs only inside the block
-- build/sql_rollback_test.py prints, after test/w281live_before.sql, so everything rolls back. No transaction control. It proves the undo puts live back:
-- the seven patched functions, crm_contact_match, crm_contacts_v and hub_roles_self_member exactly as they were (definition md5, comment, grants), and
-- every other wave281 object gone, while the consent log, the chapters (both tables and their rows), do-not-contact and text consent stay as data with
-- no API role able to read or write them (the final review, I3: Steel's rule). Raises on the first failure, with names and counts only.

do $undo$
declare r record; v text;
begin
  for r in select * from pg_temp.w281_fn_before loop
    if to_regprocedure(r.f) is null then raise exception 'w281live_undo: % is missing', r.f; end if;
    if md5(pg_get_functiondef(to_regprocedure(r.f))) <> r.def_md5 then raise exception 'w281live_undo: % is not back as it was', r.f; end if;
    if obj_description(to_regprocedure(r.f), 'pg_proc') is distinct from r.cmt then raise exception 'w281live_undo: the comment on % is not back', r.f; end if;
    if has_function_privilege('anon', to_regprocedure(r.f), 'execute') <> r.anon_x or has_function_privilege('authenticated', to_regprocedure(r.f), 'execute') <> r.auth_x
       or has_function_privilege('service_role', to_regprocedure(r.f), 'execute') <> r.svc_x then raise exception 'w281live_undo: the grants on % are not back', r.f; end if;
  end loop;
  if (select count(*) from pg_temp.w281_fn_before) <> 8 then raise exception 'w281live_undo: the before snapshot does not have eight functions'; end if;

  select * into r from pg_temp.w281_view_before;
  if md5(pg_get_viewdef('public.crm_contacts_v'::regclass, true)) <> r.def_md5 then raise exception 'w281live_undo: crm_contacts_v is not back as it was'; end if;
  if obj_description('public.crm_contacts_v'::regclass, 'pg_class') is distinct from r.cmt then raise exception 'w281live_undo: the crm_contacts_v comment is not back'; end if;
  if (select reloptions::text from pg_class where oid = 'public.crm_contacts_v'::regclass) is distinct from r.opts then raise exception 'w281live_undo: crm_contacts_v options are not back'; end if;
  select string_agg(ro || ':' || p, ',' order by ro, p) into v from unnest(array['anon', 'authenticated', 'service_role']) ro,
         unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege(ro, 'public.crm_contacts_v', p);
  if v is distinct from r.privs then raise exception 'w281live_undo: crm_contacts_v grants are not back'; end if;
  if (select md5(string_agg(to_jsonb(x)::text, '|' order by x.id)) from public.crm_contacts_v x) is distinct from (select m from pg_temp.w281_view_rows_before) then
    raise exception 'w281live_undo: crm_contacts_v rows differ from before';
  end if;

  select * into r from pg_temp.w281_policy_before;
  if not exists (select 1 from pg_policy where polname = 'hub_roles_self_member' and pg_get_expr(polwithcheck, polrelid) = r.chk and polcmd::text = r.cmd and polroles::regrole[]::text = r.roles) then
    raise exception 'w281live_undo: hub_roles_self_member is not back as it was';
  end if;

  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname in ('crm_contact_private',
               'wa_campaigns', 'wa_campaign_people', 'wa_stopped_phones_v', 'quo_messages_wa281_keyword_idx', 'whatsapp_messages_wa281_keyword_idx')) then raise exception 'w281live_undo: a wave281 table, view or index is left'; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('crm_add_chapter', 'crm_in_chapter', 'crm_consent_log', 'crm_consent_guard', 'crm_set_do_not_contact',
               'crm_age_band', 'wa_can', 'wa_my_caps', 'crm_gift_campaign_id', 'wa281_gift_campaign', 'crm_dnc_hold')) then raise exception 'w281live_undo: a wave281 function is left'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and ((table_name = 'crm_contacts' and column_name = 'job_title')
               or (table_name = 'hub_roles' and column_name = 'caps') or (table_name = 'crm_donations' and column_name = 'campaign_id')
               or (table_name = 'wa_partners' and column_name in ('keela_company_id', 'goals')))) then raise exception 'w281live_undo: a wave281 column is left'; end if;

  -- the final review (I3): kept as data, out of reach of every API role
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'crm_contacts'
        and column_name in ('sms_consent', 'sms_consent_source', 'sms_consent_at', 'do_not_contact', 'dnc_reason', 'dnc_at', 'dnc_by')) <> 7 then
    raise exception 'w281live_undo: a do-not-contact or text-consent column was dropped';
  end if;
  if to_regclass('public.crm_chapters') is null or to_regclass('public.crm_contact_chapters') is null or to_regclass('public.crm_consent_events') is null then
    raise exception 'w281live_undo: the consent log or a chapter table was dropped';
  end if;
  select * into r from pg_temp.w281_expect;
  if (select count(*) from public.crm_chapters) <> 2
     or (select count(*) from public.crm_contact_chapters where source = 'evidence' and added_by = 'wave281' and chapter = 'toronto') <> r.toronto
     or (select count(*) from public.crm_contact_chapters where source = 'evidence' and added_by = 'wave281' and chapter = 'montreal') <> r.montreal then
    raise exception 'w281live_undo: the chapter rows did not survive the undo';
  end if;
  if (select count(*) from public.crm_consent_events where column_name = 'form consent' and actor = 'wave281 backfill') <> r.form_consent
     or (select count(*) from public.crm_consent_events where source = 'change_log') <> r.change_log_rows then
    raise exception 'w281live_undo: the consent log rows did not survive the undo';
  end if;
  if exists (select 1 from unnest(array['crm_chapters', 'crm_contact_chapters', 'crm_consent_events']) t, unnest(array['anon', 'authenticated', 'service_role']) ro,
               unnest(array['select', 'insert', 'update', 'delete', 'truncate']) p where has_table_privilege(ro, 'public.' || t, p)) then
    raise exception 'w281live_undo: an API role can still read or write a kept table';
  end if;
  if exists (select 1 from pg_policy where polrelid in ('public.crm_chapters'::regclass, 'public.crm_contact_chapters'::regclass, 'public.crm_consent_events'::regclass))
     or exists (select 1 from pg_trigger where tgrelid = 'public.crm_consent_events'::regclass and not tgisinternal) then
    raise exception 'w281live_undo: a policy or trigger is left on a kept table';
  end if;
  if exists (select 1 from pg_trigger where tgname like 'trg_wa281%') or exists (select 1 from pg_policy where polname = 'wa_partners_staff_insert') then raise exception 'w281live_undo: a trigger or policy is left'; end if;
  if exists (select 1 from public.crm_fields where key in ('linkedin', 'car_make_model', 'car_seats', 'food_licence')) then raise exception 'w281live_undo: a new field is left'; end if;
  if exists (select 1 from public.crm_forms where settings ? 'campaign_id') then raise exception 'w281live_undo: a form kept campaign_id'; end if;
  if (select count(*) from public.crm_contacts) <> (select contacts from pg_temp.w281_expect) or (select count(*) from public.crm_donations) <> (select donations from pg_temp.w281_expect) then
    raise exception 'w281live_undo: a contact or gift count moved';
  end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave281' and field = 'wave281 undo') <> 1 then raise exception 'w281live_undo: not one undo line'; end if;
end $undo$;

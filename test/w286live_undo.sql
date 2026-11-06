-- wave286: checks on the live database after build/data/wa286_vm_chapter.sql and then build/data/wa286_undo.sql (run twice). Runs only inside the
-- block build/sql_rollback_test.py prints, after build/data/wa281_rules.sql (and the other slice files) and test/w286live_before.sql, so everything
-- rolls back. No transaction control. It proves the undo puts back what live had: wa266f_email_drain, wa191_recruit_pool (three arguments) and
-- volunteer_event_summary exactly (definition md5, comment, grants), every serving row and every person Find volunteers finds, and that the column,
-- the trigger and wa286_volunteer_chapters are gone. Raises on the first failure, with names and counts only.

do $undo$
declare n bigint; s record; f record; v_admin text; v_pool jsonb;
begin
  select * into f from pg_temp.w286_fn_before;
  select * into s from pg_temp.w286_state_before;
  if md5(pg_get_functiondef('public.wa266f_email_drain(integer)'::regprocedure)) <> f.drain_md5 then raise exception 'w286live_undo: the drain is not back as it was'; end if;
  if obj_description('public.wa266f_email_drain(integer)'::regprocedure, 'pg_proc') is distinct from f.drain_cmt then raise exception 'w286live_undo: the drain comment is not back'; end if;
  if (select proacl::text from pg_proc where oid = 'public.wa266f_email_drain(integer)'::regprocedure) is distinct from f.drain_acl then raise exception 'w286live_undo: the drain grants are not back'; end if;
  if to_regprocedure('public.wa191_recruit_pool(bigint[],integer,integer,text)') is not null then raise exception 'w286live_undo: the four-argument wa191_recruit_pool is left'; end if;
  if md5(pg_get_functiondef('public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure)) <> f.pool_md5 then raise exception 'w286live_undo: wa191_recruit_pool is not back as it was'; end if;
  if obj_description('public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure, 'pg_proc') is distinct from f.pool_cmt then raise exception 'w286live_undo: the wa191_recruit_pool comment is not back'; end if;
  if (select proacl::text from pg_proc where oid = 'public.wa191_recruit_pool(bigint[],integer,integer)'::regprocedure) is distinct from f.pool_acl then raise exception 'w286live_undo: the wa191_recruit_pool grants are not back'; end if;
  if md5(pg_get_viewdef('public.volunteer_event_summary'::regclass, true)) <> f.view_md5 then raise exception 'w286live_undo: volunteer_event_summary is not back as it was'; end if;
  if obj_description('public.volunteer_event_summary'::regclass, 'pg_class') is distinct from f.view_cmt then raise exception 'w286live_undo: the view comment is not back'; end if;
  if (select relacl::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) is distinct from f.view_acl then raise exception 'w286live_undo: the view grants are not back'; end if;
  if (select reloptions::text from pg_class where oid = 'public.volunteer_event_summary'::regclass) is distinct from f.view_opts then raise exception 'w286live_undo: the view is not security invoker as before'; end if;
  select count(*) into n from ((select j from pg_temp.w286_view_before except all select to_jsonb(v) from public.volunteer_event_summary v)
                               union all (select to_jsonb(v) from public.volunteer_event_summary v except all select j from pg_temp.w286_view_before)) x;
  if n <> 0 then raise exception 'w286live_undo: % serving rows differ from before', n; end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.volunteer_events'::regclass and attname = 'chapter' and not attisdropped) then raise exception 'w286live_undo: volunteer_events.chapter is left'; end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_wa286_roster_chapter') or to_regprocedure('public.wa286_roster_chapter()') is not null
     or to_regprocedure('public.wa286_volunteer_chapters()') is not null then raise exception 'w286live_undo: a wave286 trigger or function is left'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave286' and field = 'wave286 undo') <> 1 then raise exception 'w286live_undo: not one undo line'; end if;
  if (select count(*) from public.volunteer_events) <> s.servings or (select count(*) from public.event_roster) <> s.roster or (select count(*) from public.crm_contacts) <> s.contacts
     or (select count(*) from public.crm_contact_chapters) <> s.chapter_rows then
    raise exception 'w286live_undo: a serving, roster, contact or chapter count moved';
  end if;
  select email into v_admin from public.hub_roles where role = 'admin' and email <> '' order by email limit 1;
  perform set_config('request.jwt.claims', json_build_object('email', v_admin, 'role', 'authenticated')::text, true);
  v_pool := public.wa191_recruit_pool(null::bigint[], 60, 3) - 'today' - 'window_open';
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from ((select x from jsonb_array_elements((select b.j -> 'people' from pg_temp.w286_pool_before b)) x except all select x from jsonb_array_elements(v_pool -> 'people') x)
                               union all (select x from jsonb_array_elements(v_pool -> 'people') x except all select x from jsonb_array_elements((select b.j -> 'people' from pg_temp.w286_pool_before b)) x)) y;
  if n <> 0 then raise exception 'w286live_undo: Find volunteers differs from before for % people', n; end if;
end $undo$;

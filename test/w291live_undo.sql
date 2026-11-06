-- wave291: checks on the live database after build/data/wa291_optout_speed.sql and then build/data/wa291_undo.sql (run twice). Runs only inside the
-- block build/sql_rollback_test.py prints, after test/w291live_before.sql, so everything rolls back. No transaction control. It proves the undo puts
-- live back: both indexes gone, every other index on crm_contacts and quo_messages as it was, wa171_opted_out exactly as it was under the loaded
-- text (definition md5, comment, grants), its query planned as before the fix (every contact read again), and one undo line. Raises on the first
-- failure, with names and counts.

do $undo$
declare v_text text; r record;
begin
  v_text := case when position('wa_stopped_phones_v' in pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) > 0 then 'wave281' else 'today' end;
  if to_regclass('public.crm_contacts_wa291_opted_out_idx') is not null or to_regclass('public.quo_messages_wa291_stop_digits_idx') is not null then
    raise exception 'w291live_undo: a wave291 index is left';
  end if;
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname like '%wa291%')
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like '%wa291%') then
    raise exception 'w291live_undo: a wave291 object is left';
  end if;
  if (select string_agg(pg_get_indexdef(i.indexrelid), E'\n' order by pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid = 'public.crm_contacts'::regclass)
     is distinct from (select idx from pg_temp.w291_idx_before)
     or (select string_agg(pg_get_indexdef(i.indexrelid), E'\n' order by pg_get_indexdef(i.indexrelid)) from pg_index i
          where i.indrelid = 'public.quo_messages'::regclass and i.indexrelid is distinct from to_regclass('public.quo_messages_wa281_keyword_idx'))
     is distinct from (select quo from pg_temp.w291_idx_before) then
    raise exception 'w291live_undo: the indexes on crm_contacts and quo_messages are not back as they were';
  end if;

  select * into r from pg_temp.w291_fn_before where txt = v_text;
  if not found then raise exception 'w291live_undo: no before snapshot for the % text', v_text; end if;
  if md5(pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) <> r.def_md5
     or obj_description('public.wa171_opted_out(bigint,text)'::regprocedure, 'pg_proc') is distinct from r.cmt
     or has_function_privilege('anon', 'public.wa171_opted_out(bigint,text)', 'execute') <> r.anon_x
     or has_function_privilege('authenticated', 'public.wa171_opted_out(bigint,text)', 'execute') <> r.auth_x
     or has_function_privilege('service_role', 'public.wa171_opted_out(bigint,text)', 'execute') <> r.svc_x then
    raise exception 'w291live_undo: wa171_opted_out is not exactly as it was (% text)', v_text;
  end if;

  -- the query reads its tables exactly as before the fix (the same scan lines, costs aside)
  if pg_temp.w291_scan(pg_temp.w291_plan()) is distinct from pg_temp.w291_scan(r.plan) or pg_temp.w291_scan(r.plan) is null then
    raise exception 'w291live_undo: the query of wa171_opted_out does not read its tables as before the fix (% text)', v_text;
  end if;

  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave291' and field = 'wave291 undo') <> 1 then raise exception 'w291live_undo: not one undo line'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave291' and field = 'wave291') <> 1 then raise exception 'w291live_undo: the release line did not stay'; end if;
end $undo$;

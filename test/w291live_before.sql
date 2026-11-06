-- wave291: the live state before the migration, kept in temp tables for test/w291live.sql, test/w291live_undo.sql and test/w291live_report.sql.
-- Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back. No transaction control.
-- The first time: adds one invented volunteer and four invented contacts (Test W291 Live ..., 555 291 numbers: one marked no texts, one merged into
-- it and marked too, one holding the same number written another way, one not marked), keeps the indexes on crm_contacts and quo_messages, and
-- makes the temp tables, pg_temp.w291_plan() (the plan of the function's own query) and pg_temp.w291_scan() (its scan lines) that the later
-- files use. Each time: keeps wa171_opted_out's definition md5, comment, grants and plan, and its answer for every contact, every number and every
-- volunteer, under the text that is loaded (today's, or wave281's after test/w291_w281text.sql). Always without the wave291 indexes, so these are
-- the answers before the fix.
-- Personal data stays in the database: the later files compare inside it and raise only counts and names of checks.

do $before$
declare v_text text; v_vol bigint; v_stop bigint; n bigint;
begin
  if to_regclass('public.crm_contacts_wa291_opted_out_idx') is not null or to_regclass('public.quo_messages_wa291_stop_digits_idx') is not null then
    raise exception 'w291live_before: a wave291 index is already there; the answers must be kept without it';
  end if;
  v_text := case when position('wa_stopped_phones_v' in pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) > 0 then 'wave281' else 'today' end;

  if to_regclass('pg_temp.w291_ids') is null then
    insert into public.volunteer_profiles (review_note) values ('Test W291 Live: invented, rolled back') returning id into v_vol;
    insert into public.crm_contacts (full_name, phones, volunteer_id, sms_opt_out, source)
      values ('Test W291 Live Stop', array['+1 (555) 291-0001'], v_vol, true, 'manual') returning id into v_stop;
    insert into public.crm_contacts (full_name, phones, sms_opt_out, merged_into, source) values ('Test W291 Live Merged', array['555-291-0002'], true, v_stop, 'manual');
    insert into public.crm_contacts (full_name, phones, source) values ('Test W291 Live Same Number', array['555.291.0001'], 'manual');
    insert into public.crm_contacts (full_name, phones, source) values ('Test W291 Live Texts', array['(555) 291-0004'], 'manual');
    -- the plan of wa171_opted_out's own query, as a SQL function plans it (generic: p_person and p_phone are parameters), without the costs
    create function pg_temp.w291_plan() returns text language plpgsql as $plan$
    declare q text; v_line text; v_plan text := '';
    begin
      select regexp_replace(regexp_replace(regexp_replace(p.prosrc, '\mp_person\M', '$1::bigint', 'g'), '\mp_phone\M', '$2::text', 'g'), ';\s*$', '')
        into q from pg_proc p where p.oid = 'public.wa171_opted_out(bigint,text)'::regprocedure;
      for v_line in execute 'explain (generic_plan) ' || q loop
        v_plan := v_plan || regexp_replace(v_line, '\s*\(cost=[^)]*\)', '', 'g') || E'\n';
      end loop;
      return v_plan;
    end $plan$;
    -- the lines of a plan that read crm_contacts or quo_messages (the scans, and the index line under a bitmap scan)
    create function pg_temp.w291_scan(p text) returns text language sql immutable as $scan$
      select string_agg(btrim(regexp_replace(l, '^\s*->\s*', '')), ' / ' order by o)
        from regexp_split_to_table(p, E'\n') with ordinality t(l, o)
       where l ~ ' on (crm_contacts|quo_messages)( |$)' or l ~ 'Bitmap Index Scan on (crm_contacts|quo_messages)';
    $scan$;
    create temp table w291_ids (vol bigint, stop_id bigint);
    insert into pg_temp.w291_ids values (v_vol, v_stop);
    -- every index on crm_contacts, and on quo_messages apart from wave281's keyword index (so the snapshot is the same before and after wave281)
    create temp table w291_idx_before (idx text, quo text);
    insert into pg_temp.w291_idx_before
      select (select string_agg(pg_get_indexdef(i.indexrelid), E'\n' order by pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid = 'public.crm_contacts'::regclass),
             (select string_agg(pg_get_indexdef(i.indexrelid), E'\n' order by pg_get_indexdef(i.indexrelid)) from pg_index i
               where i.indrelid = 'public.quo_messages'::regclass and i.indexrelid is distinct from to_regclass('public.quo_messages_wa281_keyword_idx'));
    create temp table w291_fn_before (txt text, def_md5 text, cmt text, anon_x boolean, auth_x boolean, svc_x boolean, plan text);
    create temp table w291_answers (txt text, kind text, person bigint, phone text, answer boolean);
    create temp table w291_checked (id serial, txt text, idx boolean, answers bigint);
    create temp table w291_timing (id serial, label text, contacts bigint, opted_out bigint, ms numeric, runs int, plan text);
  end if;
  select vol into v_vol from pg_temp.w291_ids;

  -- the invented contacts answer as they should, before the fix
  if not public.wa171_opted_out(v_vol, null) or not public.wa171_opted_out(null, '15552910001') or not public.wa171_opted_out(null, '555.291.0001')
     or public.wa171_opted_out(null, '555-291-0002') or public.wa171_opted_out(null, '(555) 291-0004') or public.wa171_opted_out(null, null) then
    raise exception 'w291live_before: the invented contacts do not answer as designed (% text)', v_text;
  end if;

  if not exists (select 1 from pg_temp.w291_fn_before where txt = v_text) then
    insert into pg_temp.w291_fn_before
      select v_text, md5(pg_get_functiondef(p.oid)), obj_description(p.oid, 'pg_proc'), has_function_privilege('anon', p.oid, 'execute'),
             has_function_privilege('authenticated', p.oid, 'execute'), has_function_privilege('service_role', p.oid, 'execute'), pg_temp.w291_plan()
        from pg_proc p where p.oid = 'public.wa171_opted_out(bigint,text)'::regprocedure;
    -- every contact as the text schedule asks (its volunteer and first number), every number (on a contact or in a text received, plus three
    -- invented spellings), every volunteer
    insert into pg_temp.w291_answers
      select v_text, 'contact', x.volunteer_id, x.phones[1], public.wa171_opted_out(x.volunteer_id, x.phones[1]) from public.crm_contacts x;
    insert into pg_temp.w291_answers
      select v_text, 'phone', null, y.phone, public.wa171_opted_out(null, y.phone)
        from (select unnest(c.phones) as phone from public.crm_contacts c union select q.phone from public.quo_messages q where q.direction = 'in'
              union values ('15552910001'), ('5552910002'), ('555 291 0004')) y;
    insert into pg_temp.w291_answers
      select v_text, 'volunteer', x.volunteer_id, null, public.wa171_opted_out(x.volunteer_id, null) from public.crm_contacts x where x.volunteer_id is not null;
    select count(*) into n from pg_temp.w291_answers where txt = v_text;
    insert into pg_temp.w291_checked (txt, idx, answers) values (v_text, false, n);
  end if;
end $before$;

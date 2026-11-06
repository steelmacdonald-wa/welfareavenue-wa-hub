-- wave291: assertions on the live database after build/data/wa291_optout_speed.sql. Runs only inside the block build/sql_rollback_test.py prints, after
-- test/w291live_before.sql has kept the answers for the text that is loaded, so everything rolls back. No transaction control. Raises on the first
-- failure, with the check's name and counts only; personal data never leaves the database. Run it under today's text and under wave281's.
-- It proves: the two indexes are there once each, exactly as defined, usable and commented; nothing else on crm_contacts or quo_messages changed;
-- wa171_opted_out is untouched (definition, comment, grants); its query now reads the contacts index instead of every contact (and, under
-- wave281's text, looks the number up in the digits index); and every answer is the one it gave before the fix.

do $live$
declare v_text text; n bigint; m bigint; r record; v_plan text; v_vol bigint;
begin
  v_text := case when position('wa_stopped_phones_v' in pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) > 0 then 'wave281' else 'today' end;

  -- the indexes: once each, exactly as defined, usable by this transaction, with their comments
  if (select pg_get_indexdef(i.indexrelid) from pg_index i where i.indexrelid = to_regclass('public.crm_contacts_wa291_opted_out_idx'))
     is distinct from 'CREATE INDEX crm_contacts_wa291_opted_out_idx ON public.crm_contacts USING btree (id) WHERE (sms_opt_out AND (merged_into IS NULL))' then
    raise exception 'w291live: crm_contacts_wa291_opted_out_idx is missing or not as defined';
  end if;
  if (select replace(pg_get_indexdef(i.indexrelid), 'public.wa171_digits(', 'wa171_digits(') from pg_index i where i.indexrelid = to_regclass('public.quo_messages_wa291_stop_digits_idx'))
     is distinct from 'CREATE INDEX quo_messages_wa291_stop_digits_idx ON public.quo_messages USING btree (wa171_digits(phone)) WHERE ((direction = ''in''::text) AND (handled = ANY (ARRAY[''opted_out''::text, ''opted_in''::text])))' then
    raise exception 'w291live: quo_messages_wa291_stop_digits_idx is missing or not as defined';
  end if;
  for r in select i.*, c.relname from pg_index i join pg_class c on c.oid = i.indexrelid
            where i.indexrelid in ('public.crm_contacts_wa291_opted_out_idx'::regclass, 'public.quo_messages_wa291_stop_digits_idx'::regclass) loop
    if not (r.indisvalid and r.indisready and r.indislive) then raise exception 'w291live: % is not valid and ready', r.relname; end if;
    if r.indcheckxmin then
      raise exception 'w291live: % was built while another session had just changed a row (indcheckxmin), so this transaction cannot use it; run the check again', r.relname;
    end if;
    if coalesce(obj_description(r.indexrelid, 'pg_class'), '') not like 'wave291: %' then raise exception 'w291live: % has no wave291 comment', r.relname; end if;
  end loop;
  if (select string_agg(pg_get_indexdef(i.indexrelid), E'\n' order by pg_get_indexdef(i.indexrelid)) from pg_index i
       where i.indrelid = 'public.crm_contacts'::regclass and i.indexrelid <> 'public.crm_contacts_wa291_opted_out_idx'::regclass) is distinct from (select idx from pg_temp.w291_idx_before)
     or (select string_agg(pg_get_indexdef(i.indexrelid), E'\n' order by pg_get_indexdef(i.indexrelid)) from pg_index i
          where i.indrelid = 'public.quo_messages'::regclass and i.indexrelid <> 'public.quo_messages_wa291_stop_digits_idx'::regclass
            and i.indexrelid is distinct from to_regclass('public.quo_messages_wa281_keyword_idx')) is distinct from (select quo from pg_temp.w291_idx_before) then
    raise exception 'w291live: another index on crm_contacts or quo_messages changed';
  end if;
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname like '%wa291%'
              and relname not in ('crm_contacts_wa291_opted_out_idx', 'quo_messages_wa291_stop_digits_idx'))
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like '%wa291%') then
    raise exception 'w291live: wave291 added something besides the two indexes';
  end if;

  -- the function: exactly as it was under this text (wave291 does not touch it)
  select * into r from pg_temp.w291_fn_before where txt = v_text;
  if not found then raise exception 'w291live: no before snapshot for the % text; run test/w291live_before.sql under it first', v_text; end if;
  if md5(pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) <> r.def_md5 then raise exception 'w291live: wa171_opted_out changed (% text)', v_text; end if;
  if obj_description('public.wa171_opted_out(bigint,text)'::regprocedure, 'pg_proc') is distinct from r.cmt then raise exception 'w291live: the comment on wa171_opted_out changed'; end if;
  if has_function_privilege('anon', 'public.wa171_opted_out(bigint,text)', 'execute') <> r.anon_x
     or has_function_privilege('authenticated', 'public.wa171_opted_out(bigint,text)', 'execute') <> r.auth_x
     or has_function_privilege('service_role', 'public.wa171_opted_out(bigint,text)', 'execute') <> r.svc_x then
    raise exception 'w291live: the grants on wa171_opted_out changed';
  end if;

  -- the plan: the function's own query (generic, as a SQL function plans it) reads the contacts index, and no longer every contact; under
  -- wave281's text the stopped-phones check looks the number up in the digits index
  v_plan := pg_temp.w291_plan();
  if position('crm_contacts_wa291_opted_out_idx' in v_plan) = 0 or v_plan ~ 'Seq Scan on crm_contacts' then
    raise exception 'w291live: the query of wa171_opted_out does not read the contacts index (% text)', v_text;
  end if;
  if v_text = 'wave281' and (position('quo_messages_wa291_stop_digits_idx' in v_plan) = 0 or v_plan ~ 'Seq Scan on quo_messages') then
    raise exception 'w291live: the stopped-phones check does not read the digits index';
  end if;

  -- the invented contacts: the volunteer and the number of the one marked no texts, in any spelling, are opted out; the merged one and the
  -- one not marked are not
  select vol into v_vol from pg_temp.w291_ids;
  if not public.wa171_opted_out(v_vol, null) or not public.wa171_opted_out(null, '15552910001') or not public.wa171_opted_out(null, '555.291.0001')
     or public.wa171_opted_out(null, '555-291-0002') or public.wa171_opted_out(null, '(555) 291-0004') or public.wa171_opted_out(null, null) then
    raise exception 'w291live: the invented contacts answer wrongly with the indexes (% text)', v_text;
  end if;

  -- every answer kept before the fix, under this text, is the same now
  select count(*), count(*) filter (where public.wa171_opted_out(a.person, a.phone) is distinct from a.answer) into m, n from pg_temp.w291_answers a where a.txt = v_text;
  if m = 0 then raise exception 'w291live: no answers were kept for the % text', v_text; end if;
  if n <> 0 then raise exception 'w291live: % of % answers changed with the indexes (% text)', n, m, v_text; end if;
  insert into pg_temp.w291_checked (txt, idx, answers) values (v_text, true, m);

  -- and wave281's answers (both kept without the indexes) are today's plus the numbers whose last keyword text was a STOP: the loaded text is wave281's
  if v_text = 'wave281' and exists (select 1 from pg_temp.w291_answers where txt = 'today') then
    select count(*) into n
      from (select distinct kind, person, phone, answer from pg_temp.w291_answers where txt = 'wave281') w
      join (select distinct kind, person, phone, answer from pg_temp.w291_answers where txt = 'today') t
        on t.kind = w.kind and t.person is not distinct from w.person and t.phone is not distinct from w.phone
     where w.answer is distinct from (t.answer or exists (select 1 from public.wa_stopped_phones_v s where s.channel = 'sms' and s.phone_digits = public.wa171_digits(w.phone)));
    if n <> 0 then raise exception 'w291live: % of wave281''s answers are not today''s plus the stopped numbers', n; end if;
  end if;

  -- the release line, once
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave291' and field = 'wave291') <> 1 then raise exception 'w291live: not one release line'; end if;
end $live$;

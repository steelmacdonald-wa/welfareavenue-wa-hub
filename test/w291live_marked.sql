-- wave291: how the time depends on how many live contacts are marked no texts. With the indexes, each call reads only the marked live contacts,
-- and for each of them still compares every number (wa171_digits, twice a number), so the time grows with that list. Two timings, each inside a
-- sub-block that raises at its end, which takes its change away again: first with nobody marked (the invented contact is unmarked: this is live
-- as it is today, with none marked), then with 20 more invented contacts marked (Test W291 Live Load ..., 555 291 2001 to 2020). Each is timed
-- over every live contact as test/w291live_time.sql does and kept in pg_temp.w291_timing. Runs only inside the block build/sql_rollback_test.py
-- prints, after the migration and test/w291live_before.sql. No transaction control. Counts and milliseconds only.

do $marked$
declare t0 timestamptz; ms numeric; best numeric; spent numeric; runs int; n bigint; total bigint; v_marked bigint; v_text text; v_idx boolean;
        v_plan text; v_case int; v_stop bigint;
begin
  v_text := case when position('wa_stopped_phones_v' in pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) > 0 then 'wave281' else 'today' end;
  v_idx := to_regclass('public.crm_contacts_wa291_opted_out_idx') is not null and to_regclass('public.quo_messages_wa291_stop_digits_idx') is not null;
  select stop_id into v_stop from pg_temp.w291_ids;
  for v_case in 1..2 loop
    best := null; spent := 0; runs := 0;
    begin
      if v_case = 1 then
        update public.crm_contacts set sms_opt_out = false where id = v_stop;
      else
        insert into public.crm_contacts (full_name, phones, sms_opt_out, source)
          select 'Test W291 Live Load ' || i, array['+1 555 291 ' || (2000 + i)::text], true, 'manual' from generate_series(1, 20) i;
      end if;
      select count(*) into v_marked from public.crm_contacts where sms_opt_out and merged_into is null;
      v_plan := pg_temp.w291_scan(pg_temp.w291_plan());
      perform public.wa171_opted_out(x.volunteer_id, x.phones[1]) from public.crm_contacts x limit 5;
      select count(*) into total from public.crm_contacts x where x.merged_into is null;
      loop
        t0 := clock_timestamp();
        select count(*) filter (where public.wa171_opted_out(x.volunteer_id, x.phones[1])) into n from public.crm_contacts x where x.merged_into is null;
        ms := extract(epoch from clock_timestamp() - t0) * 1000;
        best := least(coalesce(best, ms), ms);
        spent := spent + ms;
        runs := runs + 1;
        exit when runs >= 5 or spent > 400;
      end loop;
      raise exception 'w291live_marked: done';
    exception when raise_exception then
      if sqlerrm <> 'w291live_marked: done' then raise; end if;
    end;
    if best is null then raise exception 'w291live_marked: no timing'; end if;
    insert into pg_temp.w291_timing (label, contacts, opted_out, ms, runs, plan)
      values (case when v_text = 'today' then 'today''s text' else 'wave281''s text' end || case when v_idx then ', with the indexes, ' else ', no index, ' end
              || v_marked || ' marked no texts ('
              || case when v_case = 2 then '20 of them added for this timing' when v_marked = 0 then 'the invented one unmarked: nobody, as live is today'
                      else 'the invented one unmarked' end || '):',
              total, n, round(best, 1), runs, v_plan);
  end loop;
  if exists (select 1 from public.crm_contacts where full_name like 'Test W291 Live Load %') or not (select sms_opt_out from public.crm_contacts where id = v_stop) then
    raise exception 'w291live_marked: a sub-block change was kept';
  end if;
end $marked$;

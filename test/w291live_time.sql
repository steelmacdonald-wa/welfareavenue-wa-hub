-- wave291: one timing of wa171_opted_out over every live contact, as wave281 timed it (test/w281live_timing.sql: its volunteer and first number, for
-- each contact not merged), kept in pg_temp.w291_timing (made by test/w291live_before.sql) with the plan its query gets. Run it at each step: it
-- labels itself by the text that is loaded (today's or wave281's), whether the wave291 indexes are there, and how many live contacts are marked
-- no texts. test/w291live_report.sql raises them all.
-- Runs only inside the block build/sql_rollback_test.py prints. No transaction control. Counts, milliseconds and the plan lines only.

do $time$
declare t0 timestamptz; ms numeric; best numeric; spent numeric := 0; runs int := 0; n bigint; total bigint; v_text text; v_idx boolean; v_plan text;
        v_marked bigint;
begin
  select count(*) into v_marked from public.crm_contacts where sms_opt_out and merged_into is null;
  v_text := case when position('wa_stopped_phones_v' in pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) > 0 then 'wave281' else 'today' end;
  v_idx := to_regclass('public.crm_contacts_wa291_opted_out_idx') is not null and to_regclass('public.quo_messages_wa291_stop_digits_idx') is not null;

  -- the scan lines of the plan (crm_contacts, and quo_messages under wave281's text)
  v_plan := pg_temp.w291_scan(pg_temp.w291_plan());

  -- warm up, so the first call's planning is not counted; then the best of up to five runs, stopping once 400 ms have been spent
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
  insert into pg_temp.w291_timing (label, contacts, opted_out, ms, runs, plan)
    values (case when v_text = 'today' then 'today''s text' else 'wave281''s text' end || case when v_idx then ', with the indexes, ' else ', no index, ' end
            || v_marked || ' marked no texts:', total, n, round(best, 1), runs, v_plan);
end $time$;

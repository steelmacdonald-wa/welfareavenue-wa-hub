-- wave291: how the time grows with the list of people marked no texts. With the index, each call reads only the marked live contacts, and for each
-- of them still compares every number (wa171_digits, twice a number), so the time grows with that list. Live has none marked today besides the
-- invented one. Inside a sub-block, this adds 20 more invented contacts marked no texts (Test W291 Live Load ..., 555 291 2001 to 2020), times the
-- function over every live contact as test/w291live_time.sql does, then raises inside the sub-block, which takes the 20 contacts away again, and
-- keeps only the timing in pg_temp.w291_timing. Runs only inside the block build/sql_rollback_test.py prints, after the migration. No transaction
-- control. Counts and milliseconds only.

do $more$
declare t0 timestamptz; ms numeric; best numeric; spent numeric := 0; runs int := 0; n bigint; total bigint; v_marked bigint; v_text text; v_idx boolean;
        v_plan text; v_left bigint;
begin
  v_text := case when position('wa_stopped_phones_v' in pg_get_functiondef('public.wa171_opted_out(bigint,text)'::regprocedure)) > 0 then 'wave281' else 'today' end;
  v_idx := to_regclass('public.crm_contacts_wa291_opted_out_idx') is not null;
  begin
    insert into public.crm_contacts (full_name, phones, sms_opt_out, source)
      select 'Test W291 Live Load ' || i, array['+1 555 291 ' || (2000 + i)::text], true, 'manual' from generate_series(1, 20) i;
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
    raise exception 'w291live_more: done';
  exception when raise_exception then
    if sqlerrm <> 'w291live_more: done' then raise; end if;
  end;
  select count(*) into v_left from public.crm_contacts where full_name like 'Test W291 Live Load %';
  if v_left <> 0 then raise exception 'w291live_more: % load contacts are left', v_left; end if;
  if v_marked is null or best is null then raise exception 'w291live_more: no timing'; end if;
  insert into pg_temp.w291_timing (label, contacts, opted_out, ms, runs, plan)
    values (case when v_text = 'today' then 'today''s text' else 'wave281''s text' end || case when v_idx then ', with the index, ' else ', no index, ' end
            || v_marked || ' marked no texts (20 of them added for this timing):', total, n, round(best, 1), runs, v_plan);
end $more$;

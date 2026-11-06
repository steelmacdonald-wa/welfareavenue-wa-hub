-- wave291: the result of a live check run, last in the list. It always raises: its message, W291_TIMING ..., is the result (every check before it
-- passed, or the run would have stopped there with that check's message), and everything rolls back. Runs only inside the block
-- build/sql_rollback_test.py prints. No transaction control. Counts, milliseconds, plan lines and an md5 only.

do $report$
declare v_t text; v_c text; v_k text; n bigint;
begin
  select string_agg(label || ' ' || ms || ' ms (' || runs || case when runs > 1 then ' runs, the best' else ' run' end || '; ' || coalesce(plan, '?') || ')', '; ' order by id)
    into v_t from pg_temp.w291_timing;
  select contacts into n from pg_temp.w291_timing order by id limit 1;
  select string_agg(case when txt = 'today' then 'today''s text' else 'wave281''s text' end || case when idx then ' with the index ' else ' kept before the fix ' end || answers,
                    ', ' order by id)
    into v_c from pg_temp.w291_checked;
  select string_agg(txt || ' ' || def_md5, ', ' order by txt) into v_k from pg_temp.w291_fn_before;
  raise exception 'W291_TIMING over % contacts: %. Answers: %. wa171_opted_out md5: %.', n, coalesce(v_t, 'no timings'), coalesce(v_c, 'none'), coalesce(v_k, 'none');
end $report$;

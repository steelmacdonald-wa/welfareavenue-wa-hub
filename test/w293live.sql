-- wave293: checks on the live database after slice 1 (build/data/wa281_rules.sql to wa288_toronto.sql), build/data/wa289_scan.sql,
-- build/data/wa292_batches.sql and build/data/wa293_insights.sql. Runs only inside the block build/sql_rollback_test.py prints, so everything
-- rolls back. No transaction control. Raises on the first failure with the check's name only; the overview's content never leaves the database
-- (only its shape is checked). Proved offline first by test/w293sql.mjs.

do $live$
declare o jsonb;
begin
  if to_regprocedure('public.crm_insights_overview()') is null then raise exception 'w293live: crm_insights_overview is missing'; end if;
  if (select prosecdef from pg_proc where oid = 'public.crm_insights_overview()'::regprocedure) then raise exception 'w293live: it is not security invoker'; end if;
  if has_function_privilege('anon', 'public.crm_insights_overview()', 'execute') or not has_function_privilege('authenticated', 'public.crm_insights_overview()', 'execute') then
    raise exception 'w293live: the grants'; end if;
  -- nobody signed in: the empty answer
  perform set_config('request.jwt.claims', '', true);
  o := public.crm_insights_overview();
  if (o ->> 'allowed')::boolean or jsonb_array_length(o -> 'quiet') <> 0 then raise exception 'w293live: nobody signed in is not refused'; end if;
  -- an admin of the day (the first admin row): the answer has its shape and finishes in time
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'email', (select email from public.hub_roles where role = 'admin' order by email limit 1))::text, true);
  o := public.crm_insights_overview();
  if not (o ->> 'allowed')::boolean or jsonb_typeof(o -> 'by_type_year') <> 'array' or jsonb_typeof(o -> 'orgs') <> 'array' or jsonb_typeof(o -> 'quiet') <> 'array'
     or (o ->> 'quiet_months')::int not between 1 and 120 or jsonb_array_length(o -> 'orgs') > 25 or jsonb_array_length(o -> 'quiet') > 100 then
    raise exception 'w293live: the overview''s shape'; end if;
  if position('@' in o::text) > 0 then raise exception 'w293live: an address in the overview'; end if;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'w293live: every check passed';
end $live$;

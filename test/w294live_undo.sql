-- wave294: checks on the live database after build/data/wa294_undo.sql (run twice), inside the block build/sql_rollback_test.py prints, so everything rolls
-- back. No transaction control. Raises on the first failure with the check's name only. Expects test/w294live.sql to have run before the undo, on a database
-- where keela_tag_map held wave284's value when wave294 went on (the Donor entry is skipped again afterwards) and the writer was wave284's.

do $live$
begin
  if to_regprocedure('public.crm_tag_aliases()') is not null then raise exception 'w294live_undo: crm_tag_aliases is left'; end if;
  if position('m ? ''tag''' in pg_get_functiondef('public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure)) > 0 then raise exception 'w294live_undo: the writer still has the rename branch'; end if;
  if obj_description('public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure, 'pg_proc') like '%wave294%' then raise exception 'w294live_undo: the writer comment is not wave284''s'; end if;
  if has_function_privilege('anon', 'public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.wa284_w_participation(bigint, bigint, boolean)'::regprocedure, 'execute') then raise exception 'w294live_undo: the writer grants changed'; end if;
  if ((select value::jsonb from public.app_config where key = 'keela_tag_map') -> 'Donor' ->> 'skip') is distinct from 'true' then raise exception 'w294live_undo: the map was not put back'; end if;
  if (select value::jsonb from public.app_config where key = 'keela_tag_map') ? 'Volunteer Server' then raise exception 'w294live_undo: a wave294 key is left in the map'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'wave294 undo') <> 1 then raise exception 'w294live_undo: not one undo line'; end if;
  if (select count(*) from public.change_log where entity_type = 'release' and entity_id = 'wave294' and field = 'keela_tag_map undone') <> 1 then raise exception 'w294live_undo: not one map undone line'; end if;
end $live$;

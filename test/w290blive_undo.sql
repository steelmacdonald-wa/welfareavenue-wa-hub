-- wave290b: assertions after build/data/wa290b_undo.sql. Runs only inside the block build/sql_rollback_test.py prints, so everything rolls back.
-- No transaction control.

do $undo_check$
begin
  if exists (select 1 from cron.job where jobname = 'wa-servings-shoutouts') then raise exception 'w290blive_undo: the cron job is left'; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('wa290_next_serving', 'wa290_servings_shoutouts')) then raise exception 'w290blive_undo: a wave290b function is left'; end if;
  if exists (select 1 from public.hub_shoutouts where source = 'servings' and active) then raise exception 'w290blive_undo: a servings shout-out is still showing'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wa290_home_servings') then raise exception 'w290blive_undo: wave290 went with it'; end if;
  raise notice 'w290blive_undo: wave290b is gone, wave290 stays';
end $undo_check$;

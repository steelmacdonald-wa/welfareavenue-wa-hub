-- Welfare Avenue Hub: wave293 undo, 07/11/26. Takes build/data/wa293_insights.sql back out: drops crm_insights_overview() and records the undo.
-- Nothing else to put back (wave293 changes no live definition and keeps no data). Run it before wave292's undo (the order is 293, 292, 289,
-- 284). Safe to run twice. No transaction control. Proved offline: node test/w293sql.mjs.

drop function if exists public.crm_insights_overview();

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'release', 'wave293', 'wave293 undo', null, 'wave293 taken back out: crm_insights_overview() dropped.', 'wave293'
 where not exists (select 1 from public.change_log where entity_type = 'release' and entity_id = 'wave293' and field = 'wave293 undo');

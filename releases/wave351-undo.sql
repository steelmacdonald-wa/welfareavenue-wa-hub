-- 15/11/26 - wave351 undo: the volunteer page as before wave351; the open links stop working. What was counted or noted through a link stays.
do $u$
begin
  if not exists (select 1 from public.wa351_undo where k = 'c/index.html') then raise exception 'no backup: was wave351 run?'; end if;
  update public.site_files set content = (select v from public.wa351_undo where k = 'c/index.html'), updated_at = now() where path = 'c/index.html' and part = 1;
  drop function if exists public.pb_link_add(text, text, jsonb);
  drop function if exists public.pb_link_get(text);
  drop function if exists public.pb_links_for(bigint);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave351 undo', null, 'as before wave351', 'wave351');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;

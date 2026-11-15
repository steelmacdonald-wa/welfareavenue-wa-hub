-- 15/11/26 - wave350 undo: the volunteer page as before wave350. The conversations already noted stay in pb_conversations.
do $u$
begin
  if not exists (select 1 from public.wa350_undo where k = 'c/index.html') then raise exception 'no backup: was wave350 run?'; end if;
  update public.site_files set content = (select v from public.wa350_undo where k = 'c/index.html'), updated_at = now() where path = 'c/index.html' and part = 1;
  drop function if exists public.volunteer_talk_share(text, bigint, boolean);
  drop function if exists public.volunteer_talk_add(text, jsonb);
  drop function if exists public.volunteer_talk_get(text, boolean);
  drop function if exists public.pb_talk_team(bigint);
  drop function if exists public.pb_can_share_talk(bigint);
  drop function if exists public.pb_may_talk(bigint);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave350 undo', null, 'as before wave350', 'wave350');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;

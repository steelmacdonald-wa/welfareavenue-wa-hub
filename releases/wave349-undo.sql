-- 15/11/26 - wave349 undo: the volunteer page and the two count functions as before wave349. Counts already taken stay.
do $u$
declare f text;
begin
  if (select count(*) from public.wa349_undo) <> 3 then raise exception 'no backup: was wave349 run?'; end if;
  update public.site_files set content = (select v from public.wa349_undo where k = 'c/index.html'), updated_at = now() where path = 'c/index.html' and part = 1;
  for f in select v from public.wa349_undo where k <> 'c/index.html' loop execute f; end loop;
  drop function if exists public.volunteer_tally_share(text, bigint, boolean);
  drop function if exists public.pb_count_team(bigint);
  drop function if exists public.pb_can_share_count(bigint);
  update public.event_roster set detail = detail - 'count_help' - 'count_help_by' - 'count_help_at' where detail ? 'count_help';
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'c/index.html', 'wave349 undo', null, 'as before wave349', 'wave349');
end $u$;
select public.call_edge('host-sync', '{}'::jsonb) as host_sync;

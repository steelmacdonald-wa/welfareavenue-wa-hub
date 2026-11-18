-- Welfare Avenue Hub, wave352 undo (only if needed): puts the two reply functions and the itinerary default back.
do $undo$
declare v text;
begin
  if not exists (select 1 from public.wa352_undo where k = 'wa171_inbound') then raise exception 'no backup: was wave352 run?'; end if;
  execute (select u.v from public.wa352_undo u where u.k = 'wa171_inbound');
  execute (select u.v from public.wa352_undo u where u.k = 'wa254_inbound');
  select u.v into v from public.wa352_undo u where u.k = 'itinerary_auto_default';
  if v is null then alter table public.volunteer_events alter column itinerary_auto drop default;
  else execute 'alter table public.volunteer_events alter column itinerary_auto set default ' || v; end if;
  select u.v into v from public.wa352_undo u where u.k = 'sms_auto_reply';
  if v is null then delete from public.app_config where key = 'sms_auto_reply';
  else update public.app_config set value = v where key = 'sms_auto_reply'; end if;
  drop function if exists public.wa352_follows_ask(bigint, bigint, text);
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'texts', 'wave352 undo', null, 'as before wave352', 'wave352');
end $undo$;
